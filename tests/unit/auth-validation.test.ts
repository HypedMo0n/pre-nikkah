import { describe, expect, it } from "vitest";

import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "../../features/auth/validation";

const valid = {
  locale: "en",
  email: "fictional@example.test",
  password: "fictional-demo-password",
  displayName: "Jordan",
};

describe("private account validation", () => {
  it("validates signup and preserves the create or join entry mode", () => {
    expect(signUpSchema.parse({ ...valid, entryMode: "create" }).entryMode).toBe("create");
    expect(signUpSchema.parse({ ...valid, entryMode: "join" }).entryMode).toBe("join");
  });

  it("requires a non-empty display name", () => {
    expect(signUpSchema.safeParse({ ...valid, displayName: "", entryMode: "create" }).success).toBe(false);
  });

  it("validates login without accepting weak passwords", () => {
    expect(signInSchema.safeParse(valid).success).toBe(true);
    expect(signInSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("validates forgot-password and reset-password inputs", () => {
    expect(forgotPasswordSchema.safeParse({ locale: "fr", email: valid.email }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ locale: "fr", password: valid.password }).success).toBe(true);
  });
});
