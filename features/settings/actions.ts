"use server";

import { redirect } from "next/navigation";

import { safeReturnPath } from "@/lib/auth/paths";
import { parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { appendTraceId, logServerActionError } from "@/lib/logging/server-action-error";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";

import type { SettingsActionState } from "./types";

async function callSpaceLifecycleRpc(
  rpcName: "pause_space" | "resume_space" | "unlink_partner",
  action: string,
  formData: FormData,
): Promise<SettingsActionState> {
  const locale = parseLocale(formData.get("locale"));
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc(rpcName);
  if (error) {
    const traceId = logServerActionError({ action, error, userId: user.id });
    return { status: "error", message: appendTraceId(translate(locale, "auth.genericError"), traceId) };
  }
  redirect(safeReturnPath(locale, formData.get("returnPath")));
}

export async function pauseSpaceAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  return callSpaceLifecycleRpc("pause_space", "settings.pause_space", formData);
}

export async function resumeSpaceAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  return callSpaceLifecycleRpc("resume_space", "settings.resume_space", formData);
}

export async function unlinkPartnerAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  return callSpaceLifecycleRpc("unlink_partner", "settings.unlink_partner", formData);
}
