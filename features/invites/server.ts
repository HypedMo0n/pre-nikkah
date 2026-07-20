import "server-only";

import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/require-user";
import type { Locale } from "@/lib/i18n/config";
import { logServerActionError } from "@/lib/logging/server-action-error";

import { isInviteCode, normalizeInviteCode } from "./invite-code";
import type { InviteInspection } from "./types";

const inspectionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    expiresAt: z.string().refine(
      (value) => !Number.isNaN(Date.parse(value)),
      {
        message: "Invalid date",
      },
    ),
  }),
  z.object({
    status: z.literal("unavailable"),
  }),
  z.object({
    status: z.literal("self_invite"),
  }),
  z.object({
    status: z.literal("active_couple_conflict"),
  }),
  z.object({
    status: z.literal("expired"),
  }),
  z.object({
    status: z.literal("already_used"),
  }),
  z.object({
    status: z.literal("waiting_journey_conflict"),
  }),
]);

export async function inspectInvite(
  _locale: Locale,
  inviteCode: string,
): Promise<InviteInspection> {
  if (!isInviteCode(inviteCode)) {
    console.warn("invite.inspect.invalid_code_format");

    return {
      status: "unavailable",
    };
  }

  const authenticated = await getAuthenticatedUser();

  if (!authenticated) {
    console.warn("invite.inspect.unauthenticated");

    return {
      status: "unavailable",
    };
  }

  const normalizedCode = normalizeInviteCode(inviteCode);

  const { data, error } = await authenticated.supabase.rpc(
    "inspect_couple_invite",
    {
      p_invite_code: normalizedCode,
    },
  );

  if (error) {
    console.error("invite.inspect.rpc_error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    logServerActionError({
      action: "invite.inspect",
      error,
      userId: authenticated.user.id,
    });

    return {
      status: "unavailable",
    };
  }

  const rawStatus =
    data &&
    typeof data === "object" &&
    "status" in data &&
    typeof data.status === "string"
      ? data.status
      : "unknown";

  console.info("invite.inspect.result", {
    status: rawStatus,
  });

  const parsed = inspectionSchema.safeParse(data);

  if (!parsed.success) {
    console.error("invite.inspect.zod_error", {
      receivedStatus: rawStatus,
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
        message: issue.message,
      })),
    });

    return {
      status: "unavailable",
    };
  }

  return parsed.data;
}