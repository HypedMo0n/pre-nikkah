import "server-only";

import { randomUUID } from "node:crypto";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type SafeRecordContext = {
  coupleId?: string | null;
  inviteId?: string | null;
  questionId?: string | null;
  topicId?: string | null;
};

function sanitizeMessage(message: string) {
  return message
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/\b[a-f0-9]{20,}\b/gi, "[redacted-token]")
    .replace(/(['"])[^'"]+\1/g, "[redacted-value]")
    .slice(0, 240);
}

export function logServerActionError({
  action,
  context,
  error,
  userId,
}: {
  action: string;
  context?: SafeRecordContext;
  error: SupabaseErrorLike | null | undefined;
  userId: string;
}) {
  const traceId = randomUUID().split("-")[0];
  console.error(
    JSON.stringify({
      action,
      errorCode: error?.code ?? "UNKNOWN",
      errorMessage: sanitizeMessage(error?.message ?? "Unknown database failure"),
      event: "server_action_error",
      traceId,
      userId,
      ...context,
    }),
  );
  return traceId;
}

export function appendTraceId(message: string, traceId: string) {
  return `${message} Reference: ${traceId}.`;
}
