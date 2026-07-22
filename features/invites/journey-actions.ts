"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getInviteIntent } from "@/lib/auth/invite-intent";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { appendTraceId, logServerActionError } from "@/lib/logging/server-action-error";

import type { InviteActionState } from "./types";
import {
  abandonEmptyWaitingJourney,
  type AbandonEmptyWaitingJourneyOperations,
} from "./journey-abandonment";

function createAbandonmentOperations(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"],
  userId: string,
): AbandonEmptyWaitingJourneyOperations {
  const count = async (
    table: "answers" | "topic_progress" | "guided_discussions" | "couple_checklist_items",
    coupleId: string,
  ) => {
    const { count: matching, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("couple_id", coupleId);
    return { data: matching, error };
  };

  return {
    abandon: async () => supabase.rpc("abandon_empty_waiting_journey"),
    countAnswers: (coupleId) => count("answers", coupleId),
    countChecklistItems: (coupleId) => count("couple_checklist_items", coupleId),
    countGuidedDiscussions: (coupleId) => count("guided_discussions", coupleId),
    countRedeemedInvites: async (coupleId) => {
      const { count: matching, error } = await supabase
        .from("couple_invites")
        .select("id", { count: "exact", head: true })
        .eq("couple_id", coupleId)
        .not("redeemed_at", "is", null);
      return { data: matching, error };
    },
    countTopicProgress: (coupleId) => count("topic_progress", coupleId),
    getConnectionStatus: async () => {
      const { data, error } = await supabase.rpc("get_connection_overview");
      const status = data && typeof data === "object" && "status" in data && typeof data.status === "string"
        ? data.status
        : null;
      return { data: status, error };
    },
    getCurrentCoupleId: async () => supabase.rpc("current_couple_id"),
    isSoloWaitingOwner: async (coupleId) => {
      const { data, error } = await supabase
        .from("couples")
        .select("status,user_a_id,user_b_id")
        .eq("id", coupleId)
        .maybeSingle();
      return {
        data: data?.status === "waiting" && data.user_a_id === userId && data.user_b_id === null,
        error,
      };
    },
  };
}

export async function abandonEmptyWaitingJourneyAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = parseLocale(formData.get("locale"));
  const continueToInvite = formData.get("continueToInvite") === "1";
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const result = await abandonEmptyWaitingJourney(createAbandonmentOperations(supabase, user.id));
  if (result.status === "error") {
    const traceId = logServerActionError({ action: "journey.abandon_empty_waiting", error: result.error, userId: user.id });
    return { status: "error", message: appendTraceId(translate(locale, "auth.genericError"), traceId) };
  }
  if (result.status === "not_eligible") {
    return { status: "not_eligible", message: translate(locale, "waitingJourney.notEligible") };
  }

  revalidatePath(localizedPath(locale, "/dashboard"));
  revalidatePath(localizedPath(locale, "/onboarding/waiting-journey"));
  if (continueToInvite) {
    const intent = await getInviteIntent();
    if (intent) redirect(`${localizedPath(locale, `/join/${intent.code}`)}?journeyAbandoned=1`);
  }
  redirect(`${localizedPath(locale, "/dashboard")}?journeyAbandoned=1`);
}

export async function abandonEmptyWaitingJourneyFormAction(formData: FormData) {
  const result = await abandonEmptyWaitingJourneyAction({ status: "idle" }, formData);
  if (result.status === "not_eligible") {
    redirect(localizedPath(parseLocale(formData.get("locale")), "/dashboard"));
  }
}
