export const EMPTY_WAITING_JOURNEY_ABSENT_MESSAGE =
  "No empty waiting journey is available to abandon";

type DatabaseError = {
  code?: string | null;
  message?: string | null;
};

type DatabaseResult<T> = {
  data: T;
  error: DatabaseError | null;
};

export type AbandonEmptyWaitingJourneyResult =
  | { status: "abandoned" }
  | { status: "already_absent" }
  | { status: "not_eligible" }
  | { status: "error"; error: DatabaseError };

export type AbandonEmptyWaitingJourneyOperations = {
  abandon: () => Promise<DatabaseResult<unknown>>;
  countAnswers: (coupleId: string) => Promise<DatabaseResult<number | null>>;
  countChecklistItems: (coupleId: string) => Promise<DatabaseResult<number | null>>;
  countGuidedDiscussions: (coupleId: string) => Promise<DatabaseResult<number | null>>;
  countRedeemedInvites: (coupleId: string) => Promise<DatabaseResult<number | null>>;
  countTopicProgress: (coupleId: string) => Promise<DatabaseResult<number | null>>;
  getConnectionStatus: () => Promise<DatabaseResult<string | null>>;
  getCurrentCoupleId: () => Promise<DatabaseResult<string | null>>;
  isSoloWaitingOwner: (coupleId: string) => Promise<DatabaseResult<boolean>>;
};

export function isExpectedAbsentError(error: DatabaseError | null | undefined) {
  return error?.code === "P0001" && error.message === EMPTY_WAITING_JOURNEY_ABSENT_MESSAGE;
}

export async function abandonEmptyWaitingJourney(
  operations: AbandonEmptyWaitingJourneyOperations,
): Promise<AbandonEmptyWaitingJourneyResult> {
  const connection = await operations.getConnectionStatus();
  if (connection.error) return { status: "error", error: connection.error };
  if (connection.data === "active") return { status: "not_eligible" };
  if (connection.data !== "waiting") return { status: "already_absent" };

  const couple = await operations.getCurrentCoupleId();
  if (couple.error) return { status: "error", error: couple.error };
  if (!couple.data) return { status: "already_absent" };

  const ownership = await operations.isSoloWaitingOwner(couple.data);
  if (ownership.error) return { status: "error", error: ownership.error };
  if (!ownership.data) return { status: "not_eligible" };

  const checks = await Promise.all([
    operations.countAnswers(couple.data),
    operations.countTopicProgress(couple.data),
    operations.countGuidedDiscussions(couple.data),
    operations.countChecklistItems(couple.data),
    operations.countRedeemedInvites(couple.data),
  ]);
  const failedCheck = checks.find((check) => check.error)?.error;
  if (failedCheck) return { status: "error", error: failedCheck };
  if (checks.some((check) => (check.data ?? 0) > 0)) return { status: "not_eligible" };

  const abandoned = await operations.abandon();
  if (!abandoned.error) return { status: "abandoned" };
  if (isExpectedAbsentError(abandoned.error)) return { status: "already_absent" };
  return { status: "error", error: abandoned.error };
}
