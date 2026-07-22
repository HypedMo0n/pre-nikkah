import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), "utf8");

describe("tester release UI invariants", () => {
  it("renders exactly one shared-journey closing form", () => {
    const source = read("app", "[locale]", "(private)", "settings", "page.tsx");
    expect(source.match(/<CloseJourneyForm/g)).toHaveLength(1);
  });

  it("does not render a checkmark for an incomplete checklist item", () => {
    const source = read("app", "[locale]", "(private)", "checklist", "page.tsx");
    expect(source).toContain("done ? <Check");
    expect(source).toContain('aria-pressed={done}');
  });

  it("uses four private navigation destinations with nested active states", () => {
    const source = read("components", "layout", "private-tab-bar.tsx");
    expect(source.match(/href: localizedPath/g)).toHaveLength(4);
    expect(source).toContain('pathname?.startsWith(`${href}/`)');
    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).not.toContain('localizedPath(locale, "/checklist")');
  });

  it("gates tester-only settings with the explicit environment flag", () => {
    const source = read("app", "[locale]", "(private)", "settings", "page.tsx");
    expect(source).toContain("isTesterEnvironment");
    expect(source).toContain("testerEnvironment ?");
  });

  it("does not divert authenticated waiting creators away from their requested route", () => {
    const source = read("features", "auth", "post-login-router.ts");
    expect(source).toContain("return safeNext");
    expect(source).not.toContain('status === "waiting"');
    expect(source).not.toContain('"/sign-up"');
  });

  it("requires an intentional scale selection and a real disabled Next button", () => {
    const source = read("components", "questions", "answer-form.tsx");
    expect(source).not.toContain('type === "scale"\n        ? "3"');
    expect(source).toContain("disabled={pending || state.status !== \"saved\"");
    expect(source).not.toContain("discussionPreference");
  });
});
