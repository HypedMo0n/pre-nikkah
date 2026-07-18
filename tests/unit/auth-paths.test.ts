import { describe, expect, it } from "vitest";

import { isProtectedPath, safeReturnPath } from "../../lib/auth/paths";

describe("localized auth paths", () => {
  it("protects localized private routes", () => {
    expect(isProtectedPath("/en/dashboard")).toBe(true);
    expect(isProtectedPath("/fr/onboarding/account")).toBe(true);
    expect(isProtectedPath("/en/welcome")).toBe(false);
  });

  it("rejects cross-locale and external return paths", () => {
    expect(safeReturnPath("en", "https://example.test")).toBe("/en/dashboard");
    expect(safeReturnPath("en", "/fr/dashboard")).toBe("/en/dashboard");
    expect(safeReturnPath("en", "/en/onboarding/account")).toBe("/en/onboarding/account");
  });
});
