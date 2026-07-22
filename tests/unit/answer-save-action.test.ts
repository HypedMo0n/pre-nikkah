import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  logServerActionError: vi.fn(() => "trace9999"),
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/lib/logging/server-action-error", async () => {
  const actual = await vi.importActual<typeof import("@/lib/logging/server-action-error")>("@/lib/logging/server-action-error");
  return { ...actual, logServerActionError: mocks.logServerActionError };
});

const { saveAnswerAction } = await import("@/features/answers/save-action");
const { initialAnswerSaveState } = await import("@/features/answers/types");

type Scenario = {
  answerCount?: number;
  answerSaveError?: { message: string } | null;
  connectionStatus?: "not_connected" | "waiting" | "active" | "closed";
  coupleError?: { message: string } | null;
  coupleId?: string | null;
  progressError?: { message: string } | null;
  questionCount?: number;
  questionMissing?: boolean;
};

function form(value = "4") {
  const data = new FormData();
  data.set("locale", "en");
  data.set("questionId", "10000000-0000-4000-8000-000000000301");
  data.set("value", value);
  return data;
}

function thenable<T>(result: T) {
  const chain = {
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function supabaseFor(scenario: Scenario = {}) {
  return {
    rpc: vi.fn((name: string) => {
      if (name === "get_connection_overview") {
        return Promise.resolve({ data: { status: scenario.connectionStatus ?? "active" }, error: null });
      }
      return Promise.resolve({ data: scenario.coupleId === undefined ? "20000000-0000-4000-8000-000000000001" : scenario.coupleId, error: scenario.coupleError ?? null });
    }),
    from: vi.fn((table: string) => ({
      select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
        if (table === "questions" && options?.count) {
          return thenable({ count: scenario.questionCount ?? 1, error: null });
        }
        if (table === "answers" && options?.count) {
          return thenable({ count: scenario.answerCount ?? 0, error: null });
        }
        return thenable({
          data: scenario.questionMissing ? null : {
            id: "10000000-0000-4000-8000-000000000301",
            options: null,
            topic_id: "30000000-0000-4000-8000-000000000001",
            type: "scale",
          },
          error: null,
        });
      }),
      upsert: vi.fn(() => Promise.resolve({ error: table === "topic_progress" ? scenario.progressError ?? null : scenario.answerSaveError ?? null })),
    })),
  };
}

describe("saveAnswerAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("imports and runs successfully with initialAnswerSaveState from a non-server module", async () => {
    const supabase = supabaseFor();
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    await expect(saveAnswerAction(initialAnswerSaveState, form())).resolves.toMatchObject({ status: "saved", savedValue: "4" });
  });

  it("returns saved for a valid answer", async () => {
    const supabase = supabaseFor();
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    const result = await saveAnswerAction({ status: "idle" }, form("5"));
    expect(result.status).toBe("saved");
    expect(result).toMatchObject({ message: "Saved privately", savedValue: "5" });
  });

  it("saves for a creator whose journey is waiting for their partner", async () => {
    const supabase = supabaseFor({ connectionStatus: "waiting", coupleId: "20000000-0000-4000-8000-000000000001" });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    await expect(saveAnswerAction({ status: "idle" }, form("4"))).resolves.toMatchObject({ status: "saved", savedValue: "4" });
  });

  it("returns error for an invalid answer", async () => {
    const result = await saveAnswerAction({ status: "idle", savedValue: "previous" }, form("6"));
    expect(result).toMatchObject({ status: "error", savedValue: "previous" });
  });

  it("returns an error with a trace ID when database save fails", async () => {
    const supabase = supabaseFor({ answerSaveError: { message: "insert failed" } });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    const result = await saveAnswerAction({ status: "idle" }, form("4"));
    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("trace9999") });
  });

  it("returns an error with a trace ID when topic progress fails", async () => {
    const supabase = supabaseFor({ answerCount: 1, progressError: { message: "progress failed" }, questionCount: 1 });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    const result = await saveAnswerAction({ status: "idle" }, form("4"));
    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("trace9999") });
  });

  it("returns journey_required for waiting journeys without a current couple id", async () => {
    const supabase = supabaseFor({ connectionStatus: "waiting", coupleId: null });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    await expect(saveAnswerAction({ status: "idle" }, form("4"))).resolves.toMatchObject({
      status: "journey_required",
      redirectTo: "/en/onboarding/waiting-journey",
    });
  });

  it("returns journey_required for no journey without generic Save failed", async () => {
    const supabase = supabaseFor({ connectionStatus: "not_connected", coupleId: null });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    const result = await saveAnswerAction({ status: "idle" }, form("4"));
    expect(result).toMatchObject({ status: "journey_required", redirectTo: "/en/dashboard" });
    expect(result.message).not.toBe("Save failed");
  });

  it("returns journey_required for closed journeys", async () => {
    const supabase = supabaseFor({ connectionStatus: "closed", coupleId: null });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    await expect(saveAnswerAction({ status: "idle" }, form("4"))).resolves.toMatchObject({
      status: "journey_required",
      redirectTo: "/en/dashboard",
    });
  });

  it("returns a traced error for active overview plus null current_couple_id", async () => {
    const supabase = supabaseFor({ connectionStatus: "active", coupleId: null });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "12345678-0000-4000-8000-000000000001" } });
    await expect(saveAnswerAction({ status: "idle" }, form("4"))).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("trace9999"),
    });
  });

  it("returns question_unavailable for a missing question", async () => {
    const supabase = supabaseFor({ questionMissing: true });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    await expect(saveAnswerAction({ status: "idle" }, form("4"))).resolves.toMatchObject({
      status: "question_unavailable",
      redirectTo: "/en/dashboard",
    });
  });

  it("returns a traced error when current_couple_id fails", async () => {
    const supabase = supabaseFor({ coupleError: { message: "rpc failed" } });
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    await expect(saveAnswerAction({ status: "idle" }, form("4"))).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("trace9999"),
    });
  });
});
