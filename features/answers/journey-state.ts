import { randomUUID } from "node:crypto";

import { localizedPath, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

import type { AnswerSaveState } from "./types";

export type ConnectionStatus = "not_connected" | "waiting" | "active" | "closed";

export function getConnectionStatus(data: unknown): ConnectionStatus | null {
  if (!data || typeof data !== "object" || !("status" in data)) return null;
  return ["not_connected", "waiting", "active", "closed"].includes(String(data.status))
    ? data.status as ConnectionStatus
    : null;
}

export function logAnswerContextUnavailable({ connectionStatus, questionId, reason, userId }: { connectionStatus: ConnectionStatus | null; questionId: string; reason: string; userId: string }) {
  console.error(JSON.stringify({
    connectionStatus,
    event: "answer_context_unavailable",
    questionId,
    reason,
    traceId: randomUUID().split("-")[0],
    userRef: userId.slice(0, 8),
  }));
}

export function journeyRequiredState(locale: Locale, status: ConnectionStatus | null, savedValue?: string): AnswerSaveState {
  if (status === "waiting") {
    return {
      status: "journey_required",
      message: translate(locale, "answer.waitingJourney"),
      redirectTo: localizedPath(locale, "/onboarding/waiting-journey"),
      savedValue,
    };
  }
  if (status === "closed") {
    return {
      status: "journey_required",
      message: translate(locale, "answer.closedJourney"),
      redirectTo: localizedPath(locale, "/dashboard"),
      savedValue,
    };
  }
  return {
    status: "journey_required",
    message: translate(locale, "answer.journeyRequired"),
    redirectTo: localizedPath(locale, "/dashboard"),
    savedValue,
  };
}
