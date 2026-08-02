"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearInviteIntent } from "@/lib/auth/invite-intent";
import { getAuthRedirectOrigin } from "@/lib/auth/origin";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import {
  isLocale,
  localizedPath,
  parseLocale,
  type Locale,
} from "@/lib/i18n/config";

import {
  formatInviteCode,
  invitationPath,
  isInviteCode,
  normalizeInviteCode,
} from "../invites/invite-code";
import type {
  ActionState,
  AnswerActionState,
  InviteState,
} from "./action-types";
import { getV3Copy } from "./copy";
import {
  answerSchema,
  profileSchema,
  sharedNoteSchema,
  spaceQuestionSchema,
  uuidSchema,
} from "./validation";

function errorState(locale: Locale): ActionState {
  return { status: "error", message: getV3Copy(locale).saveError };
}

function invitationState(
  locale: Locale,
  invitation: { invite_code: string; expires_at: string },
): InviteState {
  const path = invitationPath(locale, invitation.invite_code);
  const origin = getAuthRedirectOrigin();
  return {
    status: "created",
    invitation: {
      code: invitation.invite_code,
      formattedCode: formatInviteCode(invitation.invite_code),
      expiresAt: invitation.expires_at,
      link: origin ? `${origin}${path}` : path,
    },
  };
}

export async function createOrRegenerateInviteAction(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const locale = parseLocale(formData.get("locale"));
  const d = getV3Copy(locale);
  if (formData.get("privacyAccepted") !== "on") {
    return { status: "error", message: d.inviteConsentRequired };
  }
  const { supabase } = await requireAuthenticatedUser(locale);
  const { data: currentSpace } = await supabase.rpc("current_space_id");
  const result = currentSpace
    ? await supabase.rpc("regenerate_space_invite")
    : await supabase.rpc("create_space");
  const invitation = result.data?.[0];
  if (result.error || !invitation) {
    return { status: "error", message: d.saveError };
  }
  return invitationState(locale, invitation);
}

export async function redeemInviteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = parseLocale(formData.get("locale"));
  const d = getV3Copy(locale);
  const rawCode = String(formData.get("inviteCode") ?? "");
  if (
    !isInviteCode(rawCode) ||
    formData.get("privacyAccepted") !== "on"
  ) {
    return {
      status: "error",
      message:
        formData.get("privacyAccepted") !== "on"
          ? d.inviteConsentRequired
          : d.inviteUnavailable,
    };
  }
  const { supabase } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("redeem_space_invite", {
    p_invite_code: normalizeInviteCode(rawCode),
  });
  if (error) return { status: "error", message: d.inviteUnavailable };
  await clearInviteIntent();
  redirect(localizedPath(locale, "/dashboard?joined=1"));
}

export async function saveAnswerAction(
  previous: AnswerActionState,
  formData: FormData,
): Promise<AnswerActionState> {
  const locale = parseLocale(formData.get("locale"));
  const d = getV3Copy(locale);
  const parsed = answerSchema.safeParse({
    spaceId: formData.get("spaceId"),
    questionId: formData.get("questionId"),
    optionKey: formData.get("optionKey"),
    importance: formData.get("importance"),
    privateNote: formData.get("privateNote") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: d.answerRequired,
      savedOption: previous.savedOption,
    };
  }
  const { supabase } = await requireAuthenticatedUser(locale);
  const { data, error } = await supabase.rpc("save_answer", {
    p_space_id: parsed.data.spaceId,
    p_question_id: parsed.data.questionId,
    p_option_key: parsed.data.optionKey,
    p_importance: parsed.data.importance,
    p_private_note: parsed.data.privateNote || undefined,
  });
  if (error) {
    return {
      status: "error",
      message: d.saveError,
      savedOption: previous.savedOption,
    };
  }
  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  // save_answer omits both fields outside the couple's current or already
  // discussed topics, so their absence means "withheld", not "not ready".
  // Collapsing that to false would state that the partner has not reached the
  // question, which is a claim the caller is deliberately not entitled to and
  // is not known to be true.
  const partnerStateWithheld = !("partnerReady" in result);
  const comparisonState = ["pending", "aligned", "discuss"].includes(
    String(result.state),
  )
    ? (String(result.state) as AnswerActionState["comparisonState"])
    : "pending";
  revalidatePath(localizedPath(locale, "/dashboard"));
  revalidatePath(localizedPath(locale, "/topics"));
  revalidatePath(localizedPath(locale, "/comparisons"));
  return {
    status: "saved",
    message: d.saved,
    comparisonState: partnerStateWithheld ? undefined : comparisonState,
    partnerReady: partnerStateWithheld ? undefined : result.partnerReady === true,
    priority:
      result.priority === "low" ||
      result.priority === "medium" ||
      result.priority === "high"
        ? result.priority
        : undefined,
    savedOption: parsed.data.optionKey,
    savedAt: new Date().toISOString(),
  };
}

export async function shareAnswerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = parseLocale(formData.get("locale"));
  const d = getV3Copy(locale);
  const answerId = uuidSchema.safeParse(formData.get("answerId"));
  const questionId = uuidSchema.safeParse(formData.get("questionId"));
  const expectedOptionKey = formData.get("expectedOptionKey");
  if (!answerId.success || !questionId.success) return errorState(locale);
  if (typeof expectedOptionKey !== "string" || !expectedOptionKey) {
    return errorState(locale);
  }
  const { supabase } = await requireAuthenticatedUser(locale);
  // The option the confirmation screen actually showed. share_answer() raises
  // ANSWER_CHANGED if the answer moved on since.
  const { error } = await supabase.rpc("share_answer", {
    p_answer_id: answerId.data,
    p_expected_option_key: expectedOptionKey,
  });
  revalidatePath(
    localizedPath(locale, `/conversations/${questionId.data}`),
  );
  // Reported rather than swallowed. Revalidation refreshes the option this
  // form carries, so an ignored ANSWER_CHANGED would leave the confirmation
  // open and silently rebound to the new value — and the dialog does not show
  // the option, so a second click would share something never reviewed. The
  // caller closes the dialog on this state, putting the current answer back in
  // front of the person before they can share it.
  if (error) {
    return error.message?.includes("ANSWER_CHANGED")
      ? { status: "error", message: d.shareAnswerChanged }
      : errorState(locale);
  }
  return { status: "saved", message: d.shared };
}

export async function revokeAnswerAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const answerId = uuidSchema.safeParse(formData.get("answerId"));
  const questionId = uuidSchema.safeParse(formData.get("questionId"));
  if (!answerId.success || !questionId.success) return;
  const { supabase } = await requireAuthenticatedUser(locale);
  await supabase.rpc("revoke_answer", { p_answer_id: answerId.data });
  revalidatePath(
    localizedPath(locale, `/conversations/${questionId.data}`),
  );
}

export async function saveSharedNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = sharedNoteSchema.safeParse({
      spaceId: formData.get("spaceId"),
      questionId: formData.get("questionId"),
      body: formData.get("body"),
    });
  if (!parsed.success) return errorState(locale);
  const { supabase } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("add_shared_note", {
    p_space_id: parsed.data.spaceId,
    p_question_id: parsed.data.questionId,
    p_body: parsed.data.body,
  });
  if (error) return errorState(locale);
  revalidatePath(
    localizedPath(locale, `/conversations/${parsed.data.questionId}`),
  );
  return { status: "saved", message: getV3Copy(locale).saved };
}

export async function markDiscussedAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const parsed = spaceQuestionSchema.safeParse({
      spaceId: formData.get("spaceId"),
      questionId: formData.get("questionId"),
    });
  if (!parsed.success) return;
  const { supabase } = await requireAuthenticatedUser(locale);
  await supabase.rpc("mark_question_discussed", {
    p_space_id: parsed.data.spaceId,
    p_question_id: parsed.data.questionId,
  });
  revalidatePath(localizedPath(locale, "/comparisons"));
  revalidatePath(
    localizedPath(locale, `/conversations/${parsed.data.questionId}`),
  );
}

export async function markEventReadAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const eventId = uuidSchema.safeParse(formData.get("eventId"));
  if (!eventId.success) return;
  const { supabase } = await requireAuthenticatedUser(locale);
  await supabase.rpc("mark_space_event_read", {
    p_event_id: eventId.data,
  });
  revalidatePath(localizedPath(locale, "/dashboard"));
}

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = profileSchema.safeParse({
      displayName: formData.get("displayName"),
      preferredLocale: formData.get("preferredLocale"),
    });
  if (!parsed.success) return errorState(locale);
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      locale: parsed.data.preferredLocale,
    })
    .eq("id", user.id);
  if (error) return errorState(locale);
  revalidatePath(localizedPath(locale, "/settings"));
  return { status: "saved", message: getV3Copy(locale).saved };
}

export async function updateLocaleAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const preferredLocale = formData.get("preferredLocale");
  if (!isLocale(preferredLocale)) return;
  const { supabase, user } = await requireAuthenticatedUser(locale);
  await supabase
    .from("profiles")
    .update({ locale: preferredLocale })
    .eq("id", user.id);
  revalidatePath(localizedPath(locale, "/settings"));
  redirect(localizedPath(preferredLocale, "/settings"));
}

export async function setPausedAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const paused = formData.get("paused") === "true";
  const { supabase } = await requireAuthenticatedUser(locale);
  await supabase.rpc("set_space_paused", { p_paused: paused });
  revalidatePath(localizedPath(locale, "/dashboard"));
  revalidatePath(localizedPath(locale, "/settings"));
}

export async function closeSpaceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = parseLocale(formData.get("locale"));
  if (formData.get("confirmation") !== "CLOSE") {
    return errorState(locale);
  }
  const { supabase } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("close_space");
  if (error) return errorState(locale);
  redirect(localizedPath(locale, "/dashboard"));
}
