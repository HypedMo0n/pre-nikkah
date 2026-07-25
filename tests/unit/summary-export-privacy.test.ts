import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    process.cwd(),
    "app",
    "[locale]",
    "(private)",
    "summary",
    "export",
    "route.ts",
  ),
  "utf8",
);

describe("private reflection export", () => {
  it("authenticates and filters exact answers to the requesting user", () => {
    expect(source).toContain("getAuthenticatedUser");
    expect(source).toContain("answer.userId === user.id");
    expect(source).toContain('.from("private_answer_notes")');
    expect(source).toContain("excludes the partner's unshared exact answers");
    expect(source).not.toContain("createAdminClient");
  });

  it("prevents intermediary caching and content sniffing", () => {
    expect(source).toContain('"Cache-Control": "private, no-store"');
    expect(source).toContain('"X-Content-Type-Options": "nosniff"');
  });
});
