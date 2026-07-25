import { describe, expect, it } from "vitest";

import { isProtectedPath, safeReturnPath } from "../../lib/auth/paths";

describe("localized auth paths", () => {
  it("protects localized private routes", () => {
    expect(isProtectedPath("/en/home")).toBe(true);
    expect(isProtectedPath("/fr/invite")).toBe(true);
    expect(isProtectedPath("/en/create-space")).toBe(false);
    expect(isProtectedPath("/en/sign-in")).toBe(false);
  });

  it("rejects cross-locale and external return paths", () => {
    expect(safeReturnPath("en", "https://example.test")).toBe("/en/home");
    expect(safeReturnPath("en", "/fr/home")).toBe("/en/home");
    expect(safeReturnPath("en", "/en/invite")).toBe("/en/invite");
  });
});
