"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

export type SettingsActionState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

export const initialSettingsActionState: SettingsActionState = { status: "idle" };

const displayNameSchema = z.object({
  privateDisplayName: z.string().trim().max(60),
});

export async function updatePrivateDisplayNameAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = displayNameSchema.safeParse({
    privateDisplayName: formData.get("privateDisplayName") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }

  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase
    .from("private_accounts")
    .update({ private_display_name: parsed.data.privateDisplayName || null })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }

  revalidatePath(localizedPath(locale, "/settings"));
  return { status: "saved", message: translate(locale, "status.saved") };
}

const closeJourneySchema = z.object({ confirmation: z.literal("CLOSE") });

export async function closeJourneyAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = closeJourneySchema.safeParse({
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "settings.closeInvalid") };
  }

  const { supabase } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("close_couple_journey");
  if (error) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }

  redirect(localizedPath(locale, "/dashboard"));
}
