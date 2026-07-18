"use server";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

import { deleteVerifiedAuthenticatedAccount } from "./service";
import { deletionRequestSchema, hasForbiddenDeletionTarget } from "./validation";

export type DeleteAccountState = { status: "idle" | "error"; message?: string };
export const initialDeleteAccountState: DeleteAccountState = { status: "idle" };

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
  } catch {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect(localizedPath(locale, "/account-deleted"));
}
