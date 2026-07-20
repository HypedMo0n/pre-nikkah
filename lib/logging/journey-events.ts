import { generateTraceId } from "./trace-id";

/**
 * Log invite inspection event with sanitized invite code.
 * Only log first 4 characters to avoid exposing the full code.
 */
export function logInviteInspection({
  inviteCodePrefix,
  status,
  userId,
}: {
  inviteCodePrefix: string;
  status: string;
  userId: string;
}): string {
  const traceId = generateTraceId();
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      action: "invite.inspect",
      traceId,
      userId,
      inviteCodePrefix,
      status,
    }),
  );
  return traceId;
}

/**
 * Log waiting journey conflict when user attempts to redeem while in waiting state.
 */
export function logWaitingJourneyConflict({
  userId,
  attemptedInviteCodePrefix,
}: {
  userId: string;
  attemptedInviteCodePrefix: string;
}): string {
  const traceId = generateTraceId();
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      action: "invite.waiting_journey_conflict",
      traceId,
      userId,
      attemptedInviteCodePrefix,
      message: "User in waiting journey attempted to redeem different invite",
    }),
  );
  return traceId;
}

/**
 * Log empty journey abandonment.
 */
export function logEmptyJourneyAbandonment({
  userId,
  success,
}: {
  userId: string;
  success: boolean;
}): string {
  const traceId = generateTraceId();
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      action: "journey.abandon_empty",
      traceId,
      userId,
      success,
    }),
  );
  return traceId;
}
