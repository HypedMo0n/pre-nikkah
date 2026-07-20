"use server";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import type { Locale } from "@/lib/i18n/config";
import { parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import {
  appendTraceId,
  logServerActionError,
} from "@/lib/logging/server-action-error";

import type { InviteActionState } from "./types";

function inviteError(locale: Locale, traceId?: string): InviteActionState {
  const message = translate(locale, "auth.genericError");
  return {
    status: "error",
    message: traceId ? appendTraceId(message, traceId) : message,
  };
}

export async function abandonEmptyJourneyAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = parseLocale(formData.get("locale"));
  const { supabase, user } = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("abandon_empty_waiting_journey");

  if (error) {
    const errorMessage = error.message || "";
    let userMessage = translate(locale, "auth.genericError");

    if (errorMessage === "NO_EMPTY_JOURNEY_TO_ABANDON") {
      userMessage = translate(locale, "journey.noEmptyJourneyToAbandon");
    }

    const traceId = logServerActionError({
      action: "journey.abandon_empty",
      context: { errorCode: errorMessage },
      error,
      userId: user.id,
    });

    return {
      status: "error",
      message: appendTraceId(userMessage, traceId),
    };
  }

  return { status: "abandoned" };
}
