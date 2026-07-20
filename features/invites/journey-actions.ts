"use server";

import { redirect } from "next/navigation";

import { getInviteIntent } from "@/lib/auth/invite-intent";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { appendTraceId, logServerActionError } from "@/lib/logging/server-action-error";

import type { InviteActionState } from "./types";

export async function abandonEmptyWaitingJourneyAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = parseLocale(formData.get("locale"));
  const continueToInvite = formData.get("continueToInvite") === "1";
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("abandon_empty_waiting_journey");
  if (error) {
    const traceId = logServerActionError({ action: "journey.abandon_empty_waiting", error, userId: user.id });
    return { status: "error", message: appendTraceId(translate(locale, "auth.genericError"), traceId) };
  }
  if (continueToInvite) {
    const intent = await getInviteIntent();
    if (intent) redirect(localizedPath(locale, `/join/${intent.code}`));
  }
  redirect(localizedPath(locale, "/dashboard"));
}

export async function abandonEmptyWaitingJourneyFormAction(formData: FormData) {
  await abandonEmptyWaitingJourneyAction({ status: "idle" }, formData);
}
