import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) =>
  readFileSync(path.join(process.cwd(), ...parts), "utf8");

describe("v3 release UI invariants", () => {
  it("requires an intentional structured answer before continuing", () => {
    const source = read("components", "v3", "answer-form.tsx");
    expect(source).toContain("<OptionCard");
    expect(source).toContain("<ImportanceRow");
    expect(source).toContain("disabled={pending || !optionKey}");
    expect(source).toContain('name="privateNote"');
  });

  it("warns that exact-answer sharing is permanent and keeps notes separate", () => {
    const pageSource = read(
      "app",
      "[locale]",
      "(private)",
      "conversations",
      "[questionId]",
      "page.tsx",
    );
    const sheetSource = read("components", "v3", "share-answer-sheet.tsx");
    expect(pageSource).toContain("<ShareAnswerSheet");
    expect(sheetSource).toContain("d.shareWarning");
    expect(sheetSource).toContain("shareAnswerAction");
    expect(pageSource).not.toContain("private_answer_notes");
    expect(sheetSource).not.toContain("private_answer_notes");
  });

  it("renders exactly one end-space control", () => {
    const source = read(
      "app",
      "[locale]",
      "(private)",
      "settings",
      "page.tsx",
    );
    expect(source.match(/<CloseSpaceForm/g)).toHaveLength(1);
    expect(source).toContain("setPausedAction");
  });

  it("keeps the private app navigation to four stable destinations", () => {
    const source = read("components", "layout", "private-tab-bar.tsx");
    expect(source.match(/localizedPath\(locale,/g)).toHaveLength(4);
    expect(source).not.toContain("/checklist");
  });
});
