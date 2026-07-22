import { describe, expect, it, vi } from "vitest";

import {
  abandonEmptyWaitingJourney,
  EMPTY_WAITING_JOURNEY_ABSENT_MESSAGE,
  type AbandonEmptyWaitingJourneyOperations,
} from "../../features/invites/journey-abandonment";

function result<T>(data: T, error: { code?: string; message?: string } | null = null) {
  return Promise.resolve({ data, error });
}

function operations(
  overrides: Partial<AbandonEmptyWaitingJourneyOperations> = {},
): AbandonEmptyWaitingJourneyOperations {
  return {
    abandon: vi.fn(() => result(null)),
    countAnswers: vi.fn(() => result(0)),
    countChecklistItems: vi.fn(() => result(0)),
    countGuidedDiscussions: vi.fn(() => result(0)),
    countRedeemedInvites: vi.fn(() => result(0)),
    countTopicProgress: vi.fn(() => result(0)),
    getConnectionStatus: vi.fn(() => result("waiting")),
    getCurrentCoupleId: vi.fn(() => result("couple-1")),
    isSoloWaitingOwner: vi.fn(() => result(true)),
    ...overrides,
  };
}

describe("empty waiting journey abandonment", () => {
  it("abandons an eligible empty waiting journey", async () => {
    const gateway = operations();

    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "abandoned" });
    expect(gateway.abandon).toHaveBeenCalledOnce();
  });

  it("returns already_absent when there is no waiting journey", async () => {
    const gateway = operations({ getConnectionStatus: vi.fn(() => result("not_connected")) });

    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "already_absent" });
    expect(gateway.abandon).not.toHaveBeenCalled();
  });

  it("returns not_eligible when the waiting journey has answers", async () => {
    const gateway = operations({ countAnswers: vi.fn(() => result(1)) });

    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "not_eligible" });
    expect(gateway.abandon).not.toHaveBeenCalled();
  });

  it("never calls the abandon RPC for an active journey", async () => {
    const gateway = operations({ getConnectionStatus: vi.fn(() => result("active")) });

    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "not_eligible" });
    expect(gateway.getCurrentCoupleId).not.toHaveBeenCalled();
    expect(gateway.abandon).not.toHaveBeenCalled();
  });

  it("succeeds safely when abandonment is repeated", async () => {
    let status = "waiting";
    const gateway = operations({
      abandon: vi.fn(async () => {
        status = "not_connected";
        return { data: null, error: null };
      }),
      getConnectionStatus: vi.fn(() => result(status)),
    });

    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "abandoned" });
    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "already_absent" });
    expect(gateway.abandon).toHaveBeenCalledOnce();
  });

  it("maps the known P0001 race outcome to already_absent", async () => {
    const gateway = operations({
      abandon: vi.fn(() => result(null, {
        code: "P0001",
        message: EMPTY_WAITING_JOURNEY_ABSENT_MESSAGE,
      })),
    });

    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "already_absent" });
  });

  it("keeps other P0001 errors unexpected", async () => {
    const error = { code: "P0001", message: "Another database invariant failed" };
    const gateway = operations({ abandon: vi.fn(() => result(null, error)) });

    await expect(abandonEmptyWaitingJourney(gateway)).resolves.toEqual({ status: "error", error });
  });
});
