import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  appendTraceId,
  logServerActionError,
} from "@/lib/logging/server-action-error";

describe("server action error logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs only sanitized error details and whitelisted record IDs", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const traceId = logServerActionError({
      action: "answer.save",
      context: {
        coupleId: "10000000-0000-4000-8000-000000000001",
        questionId: "20000000-0000-4000-8000-000000000001",
      },
      error: {
        code: "P0001",
        message:
          "Failure for person@example.test with 'private answer' and abcdef0123456789abcdef0123456789",
      },
      userId: "30000000-0000-4000-8000-000000000001",
    });

    expect(traceId).toMatch(/^[0-9a-f]{8}$/i);
    const event = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
    expect(event).toMatchObject({
      action: "answer.save",
      errorCode: "P0001",
      event: "server_action_error",
      traceId,
    });
    expect(event.errorMessage).not.toContain("person@example.test");
    expect(event.errorMessage).not.toContain("private answer");
    expect(event.errorMessage).not.toContain("abcdef0123456789abcdef0123456789");
  });

  it("adds a short support reference without changing the safe message", () => {
    expect(appendTraceId("Save failed", "abc12345")).toBe(
      "Save failed Reference: abc12345.",
    );
  });
});
