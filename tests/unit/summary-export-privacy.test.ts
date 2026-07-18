import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("permitted summary export", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "[locale]", "(private)", "summary", "export", "route.ts"), "utf8");

  it("authenticates in the route handler and never queries raw answers", () => {
    expect(source).toContain("getAuthenticatedUser");
    expect(source).not.toContain('.from("answers")');
    expect(source).toContain("intentionally excludes all raw answers");
  });
});
