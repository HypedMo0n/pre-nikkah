import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { validateFeedbackFormUrl } from "@/lib/feedback/form-url";
import { getDictionary } from "@/lib/i18n/dictionaries";

describe("Google Forms feedback handoff", () => {
  it("accepts supported HTTPS responder hosts and removes query data", () => {
    expect(
      validateFeedbackFormUrl(
        "https://docs.google.com/forms/d/e/example/viewform?usp=sf_link&email=private%40example.test",
      ),
    ).toEqual({
      status: "configured",
      url: "https://docs.google.com/forms/d/e/example/viewform",
    });
    expect(validateFeedbackFormUrl("https://forms.gle/opaqueToken")).toEqual({
      status: "configured",
      url: "https://forms.gle/opaqueToken",
    });
  });

  it("fails closed for missing, non-HTTPS, and unrelated URLs", () => {
    expect(validateFeedbackFormUrl()).toEqual({ status: "missing", url: null });
    expect(validateFeedbackFormUrl("http://forms.gle/example")).toEqual({ status: "invalid", url: null });
    expect(validateFeedbackFormUrl("https://example.com/forms/test")).toEqual({ status: "invalid", url: null });
  });

  it("uses safe new-tab attributes and no dynamic query construction", () => {
    const source = readFileSync("components/feedback/feedback-link.tsx", "utf8");
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("email");
    expect(source).not.toContain("inviteCode");
    expect(source).not.toContain("journeyId");
  });

  it("has complete English and French handoff copy", () => {
    for (const locale of ["en", "fr"] as const) {
      const dictionary = getDictionary(locale);
      expect(dictionary["controlled.title"]).toBeTruthy();
      expect(dictionary["feedback.action"]).toBeTruthy();
      expect(dictionary["feedback.hosted"]).toBeTruthy();
    }
  });
});
