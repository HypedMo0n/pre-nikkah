import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    process.cwd(),
    "app",
    "[locale]",
    "(private)",
    "topics",
    "[slug]",
    "questions",
    "[questionId]",
    "page.tsx",
  ),
  "utf8",
);

describe("v3 question route guard", () => {
  it("requires an authenticated current space before rendering", () => {
    expect(source).toContain("requireAuthenticatedUser");
    expect(source).toContain("if (!data.overview.spaceId)");
    expect(source).toContain('redirect(localizedPath(locale, "/dashboard"))');
  });

  it("loads only the current user's private note through RLS", () => {
    expect(source).toContain('.from("private_answer_notes")');
    expect(source).toContain('.eq("answer_id", ownAnswer.id)');
    expect(source).toContain("answer.userId === user.id");
  });

  it("renders the typed structured answer component", () => {
    expect(source).toContain("<V3AnswerForm");
    expect(source).toContain("options={question.options}");
    expect(source).toContain("spaceId={data.overview.spaceId}");
  });
});
