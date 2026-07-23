"use server";

import { redirect } from "next/navigation";

import { getAuthRedirectOrigin } from "@/lib/auth/origin";
import { clearInviteIntent } from "@/lib/auth/invite-intent";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { appendTraceId, logServerActionError } from "@/lib/logging/server-action-error";

import { formatInviteCode, invitationPath, isInviteCode, normalizeInviteCode } from "@/features/invites/invite-code";
import type { RedeemInviteState, SpaceInviteState } from "./types";

function inviteError(locale: Locale, traceId?: string): SpaceInviteState {
  const message = translate(locale, "auth.genericError");
  return { status: "error", message: traceId ? appendTraceId(message, traceId) : message };
}

// ACTIVE_SPACE_CONFLICT is a business-rule rejection (the user already has
// an active space), not a fault — its own message, no trace-id retry prompt.
function createInviteErrorMessage(locale: Locale, error: { message?: string | null } | null, traceId?: string): string {
  if (error?.message === "ACTIVE_SPACE_CONFLICT") {
    return translate(locale, "invite.activeSpaceConflict");
  }
  const message = translate(locale, "auth.genericError");
  return traceId ? appendTraceId(message, traceId) : message;
}

export async function createSpaceInviteAction(
  _previousState: SpaceInviteState,
  formData: FormData,
): Promise<SpaceInviteState> {
  const locale = parseLocale(formData.get("locale"));
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data, error } = await supabase.rpc("create_space_invite");
  const invitation = data?.[0];
  if (error || !invitation) {
    const traceId = logServerActionError({ action: "space.create_invite", error, userId: user.id });
    return { status: "error", message: createInviteErrorMessage(locale, error, traceId) };
  }

  const path = invitationPath(locale, invitation.invite_code);
  const origin = getAuthRedirectOrigin();
  return {
    status: "created",
    invitation: {
      id: invitation.invite_id,
      code: invitation.invite_code,
      formattedCode: formatInviteCode(invitation.invite_code),
      expiresAt: invitation.expires_at,
      link: origin ? `${origin}${path}` : null,
    },
  };
}

export async function revokeSpaceInviteAction(
  _previousState: SpaceInviteState,
  formData: FormData,
): Promise<SpaceInviteState> {
  const locale = parseLocale(formData.get("locale"));
  const inviteId = formData.get("inviteId");
  if (typeof inviteId !== "string" || !/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return inviteError(locale);
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("revoke_space_invite", { p_invite_id: inviteId });
  if (error) {
    const traceId = logServerActionError({
      action: "space.revoke_invite",
      context: { inviteId },
      error,
      userId: user.id,
    });
    return inviteError(locale, traceId);
  }
  return { status: "revoked" };
}

export async function redeemSpaceInviteAction(
  _previousState: RedeemInviteState,
  formData: FormData,
): Promise<RedeemInviteState> {
  const locale = parseLocale(formData.get("locale"));
  const rawCode = String(formData.get("inviteCode") ?? "");
  if (!isInviteCode(rawCode)) {
    return { status: "error", message: translate(locale, "join.unavailable") };
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("redeem_space_invite", {
    p_invite_code: normalizeInviteCode(rawCode),
  });
  if (error) {
    const traceId = logServerActionError({ action: "space.redeem_invite", error, userId: user.id });
    const message =
      error.message === "ACTIVE_SPACE_CONFLICT"
        ? translate(locale, "invite.activeSpaceConflict")
        : appendTraceId(translate(locale, "join.unavailable"), traceId);
    return { status: "error", message };
  }

  await clearInviteIntent();
  redirect(localizedPath(locale, "/home?joined=1"));
}
