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
  progressError?: { message: string } | null;
  questionCount?: number;
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
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function supabaseFor(scenario: Scenario = {}) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: "20000000-0000-4000-8000-000000000001", error: null }),
    from: vi.fn((table: string) => ({
      select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
        if (table === "questions" && options?.count) {
          return thenable({ count: scenario.questionCount ?? 1, error: null });
        }
        if (table === "answers" && options?.count) {
          return thenable({ count: scenario.answerCount ?? 0, error: null });
        }
        return thenable({
          data: {
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
    expect(result).toMatchObject({ message: "Saved", savedValue: "5" });
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
});
