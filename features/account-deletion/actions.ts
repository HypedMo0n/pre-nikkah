"use server";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { appendTraceId, logServerActionError } from "@/lib/logging/server-action-error";

import { deleteVerifiedAuthenticatedAccount } from "./service";
import type { DeleteAccountState } from "./types";
import { deletionRequestSchema, hasForbiddenDeletionTarget } from "./validation";

export async function deleteOwnAccountAction(_previous: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const locale = parseLocale(formData.get("locale"));
  if (hasForbiddenDeletionTarget(formData.entries())) return { status: "error", message: translate(locale, "auth.genericError") };
  const parsed = deletionRequestSchema.safeParse({ confirmation: formData.get("confirmation"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: translate(locale, "auth.genericError") };
  const { supabase, user } = await requireAuthenticatedUser(locale);
  if (!user.email) return { status: "error", message: translate(locale, "auth.genericError") };
  const { error: reauthenticationError } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
  if (reauthenticationError) return { status: "error", message: translate(locale, "auth.invalidCredentials") };
  try {
    // The privileged target is derived exclusively from the verified session user.
    await deleteVerifiedAuthenticatedAccount(user.id);
  } catch (error) {
    const traceId = error instanceof Error
      ? error.message.match(/^ACCOUNT_DELETION_FAILED:([a-f0-9-]+)$/i)?.[1]
      : undefined;
    const message = translate(locale, "auth.genericError");
    return {
      status: "error",
      message: traceId ? appendTraceId(message, traceId) : message,
    };
  }
  const redirectTo = localizedPath(locale, "/account-deleted");
  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      logServerActionError({
        action: "account_deletion.local_sign_out",
        error: signOutError,
        userId: "deleted-user",
      });
    }
  } catch (error) {
    logServerActionError({
      action: "account_deletion.local_sign_out",
      error: error instanceof Error ? { message: error.message } : { message: "Unknown sign-out failure" },
      userId: "deleted-user",
    });
  }
  return { status: "deleted", redirectTo };
}
