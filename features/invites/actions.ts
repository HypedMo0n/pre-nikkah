"use server";

import { redirect } from "next/navigation";

import { getAuthRedirectOrigin } from "@/lib/auth/origin";
import { clearInviteIntent } from "@/lib/auth/invite-intent";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import {
  appendTraceId,
  logServerActionError,
} from "@/lib/logging/server-action-error";

import {
  formatInviteCode,
  invitationPath,
  isInviteCode,
  normalizeInviteCode,
} from "./invite-code";
import type { InviteActionState } from "./types";

function inviteError(locale: Locale, traceId?: string): InviteActionState {
  const message = translate(locale, "auth.genericError");
  return {
    status: "error",
    message: traceId ? appendTraceId(message, traceId) : message,
  };
}

// ACTIVE_COUPLE_CONFLICT is a business-rule rejection (the user already has
// an active journey), not a fault — it gets its own message so retrying
// isn't presented as a plausible fix. Every other error keeps the generic
// message and trace reference; internal error detail is never surfaced.
function createInviteErrorMessage(locale: Locale, error: { message?: string | null } | null, traceId?: string): string {
  if (error?.message === "ACTIVE_COUPLE_CONFLICT") {
    return translate(locale, "invite.activeCoupleConflict");
  }
  const message = translate(locale, "auth.genericError");
  return traceId ? appendTraceId(message, traceId) : message;
}

export async function createInviteAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = parseLocale(formData.get("locale"));
  if (formData.get("policyAccepted") !== "on") {
    return inviteError(locale);
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: policyVersion, error: policyError } = await supabase.rpc(
    "current_journey_policy_version",
  );
  if (policyError || !policyVersion) {
    const traceId = logServerActionError({
      action: "invite.create.policy_version",
      error: policyError,
      userId: user.id,
    });
    return inviteError(locale, traceId);
  }
  const { data, error } = await supabase.rpc("create_couple_invite", {
    p_policy_version: policyVersion,
  });
  const invitation = data?.[0];
  if (error || !invitation) {
    const traceId = logServerActionError({
      action: "invite.create",
      error,
      userId: user.id,
    });
    return { status: "error", message: createInviteErrorMessage(locale, error, traceId) };
  }

  await supabase
    .from("private_accounts")
    .update({
      onboarding_completed: true,
      onboarding_step: null,
      entry_mode: "create",
    })
    .eq("id", user.id);

  const path = invitationPath(locale, invitation.invite_code);
  const origin = getAuthRedirectOrigin();
  return {
    status: "created",
    invitation: {
      id: invitation.invite_id,
      code: invitation.invite_code,
      formattedCode: formatInviteCode(invitation.invite_code),
      expiresAt: invitation.expires_at,
      link: origin ? `${origin}${path}` : path,
    },
  };
}

export async function revokeInviteAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = parseLocale(formData.get("locale"));
  const inviteId = formData.get("inviteId");
  if (typeof inviteId !== "string" || !/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return inviteError(locale);
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("revoke_couple_invite", {
    p_invite_id: inviteId,
  });
  if (error) {
    const traceId = logServerActionError({
      action: "invite.revoke",
      context: { inviteId },
      error,
      userId: user.id,
    });
    return inviteError(locale, traceId);
  }
  return { status: "revoked" };
}

export async function redeemInviteAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = parseLocale(formData.get("locale"));
  const rawCode = String(formData.get("inviteCode") ?? "");
  if (!isInviteCode(rawCode) || formData.get("policyAccepted") !== "on") {
    return inviteError(locale);
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: policyVersion, error: policyError } = await supabase.rpc(
    "current_journey_policy_version",
  );
  if (policyError || !policyVersion) {
    const traceId = logServerActionError({
      action: "invite.redeem.policy_version",
      error: policyError,
      userId: user.id,
    });
    return inviteError(locale, traceId);
  }
  const { error } = await supabase.rpc("redeem_couple_invite", {
    p_invite_code: normalizeInviteCode(rawCode),
    p_policy_version: policyVersion,
  });
  if (error) {
    const traceId = logServerActionError({
      action: "invite.redeem",
      error,
      userId: user.id,
    });
    return inviteError(locale, traceId);
  }

  await supabase
    .from("private_accounts")
    .update({
      onboarding_completed: true,
      onboarding_step: null,
      entry_mode: "join",
    })
    .eq("id", user.id);
  await clearInviteIntent();
  redirect(localizedPath(locale, "/dashboard?joined=1"));
}
