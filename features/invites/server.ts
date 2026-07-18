import "server-only";

import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/require-user";
import type { Locale } from "@/lib/i18n/config";

import { isInviteCode, normalizeInviteCode } from "./invite-code";
import type { InviteInspection } from "./types";

const inspectionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), expiresAt: z.string().datetime() }),
  z.object({ status: z.literal("unavailable") }),
  z.object({ status: z.literal("self_invite") }),
  z.object({ status: z.literal("active_couple_conflict") }),
]);

export async function inspectInvite(
  _locale: Locale,
  inviteCode: string,
): Promise<InviteInspection> {
  if (!isInviteCode(inviteCode)) {
    return { status: "unavailable" };
  }
  const authenticated = await getAuthenticatedUser();
  if (!authenticated) {
    return { status: "unavailable" };
  }

  const { data, error } = await authenticated.supabase.rpc("inspect_couple_invite", {
    p_invite_code: normalizeInviteCode(inviteCode),
  });
  if (error) {
    return { status: "unavailable" };
  }
  const parsed = inspectionSchema.safeParse(data);
  return parsed.success ? parsed.data : { status: "unavailable" };
}
