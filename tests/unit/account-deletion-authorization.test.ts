import { describe, expect, it } from "vitest";

import { deletionRequestSchema, hasForbiddenDeletionTarget } from "../../features/account-deletion/validation";

describe("account deletion request authorization", () => {
  it("requires deliberate confirmation and password reconfirmation", () => {
    expect(deletionRequestSchema.safeParse({ confirmation: "DELETE", password: "a-safe-demo-password" }).success).toBe(true);
    expect(deletionRequestSchema.safeParse({ confirmation: "delete", password: "a-safe-demo-password" }).success).toBe(false);
  });

  it("rejects attempts to submit another user UUID", () => {
    expect(hasForbiddenDeletionTarget([["confirmation", "DELETE"], ["targetUserId", "20000000-0000-4000-8000-000000000001"]])).toBe(true);
    expect(hasForbiddenDeletionTarget([["confirmation", "DELETE"], ["password", "a-safe-demo-password"]])).toBe(false);
  });
});
