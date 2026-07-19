import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getFeedbackUrl, validateFeedbackFormUrl } from "@/lib/feedback/form-url";
import { getDictionary } from "@/lib/i18n/dictionaries";

const approvedUrl = "https://www.cognitoforms.com/PreNikah/PreNikahAlphaFeedback2";

describe("provider-neutral feedback handoff", () => {
  it("accepts only the approved Cognito Forms endpoint", () => {
    expect(validateFeedbackFormUrl(approvedUrl)).toEqual({
      status: "configured",
      url: approvedUrl,
    });
    expect(getFeedbackUrl(approvedUrl)).toBe(approvedUrl);
  });

  it.each([
    "http://www.cognitoforms.com/PreNikah/PreNikahAlphaFeedback2",
    "https://cognitoforms.com/PreNikah/PreNikahAlphaFeedback2",
    "https://www.cognitoforms.com.example.test/PreNikah/PreNikahAlphaFeedback2",
    "https://www.cognitoforms.example/PreNikah/PreNikahAlphaFeedback2",
    "https://127.0.0.1/PreNikah/PreNikahAlphaFeedback2",
    "https://localhost/PreNikah/PreNikahAlphaFeedback2",
    "https://user:password@www.cognitoforms.com/PreNikah/PreNikahAlphaFeedback2",
    "https://www.cognitoforms.com:444/PreNikah/PreNikahAlphaFeedback2",
    "https://www.cognitoforms.com/PreNikah/AnotherForm",
    "javascript:alert(1)",
    "data:text/html,feedback",
    "not a URL",
  ])("rejects an unapproved URL: %s", (url) => {
    expect(validateFeedbackFormUrl(url)).toEqual({ status: "invalid", url: null });
    expect(getFeedbackUrl(url)).toBeNull();
  });

  it("rejects query strings and fragments rather than forwarding context", () => {
    expect(validateFeedbackFormUrl(`${approvedUrl}?journeyId=private`)).toEqual({
      status: "invalid",
      url: null,
    });
    expect(validateFeedbackFormUrl(`${approvedUrl}#answer-id`)).toEqual({
      status: "invalid",
      url: null,
    });
  });

  it("fails closed when configuration is missing", () => {
    expect(validateFeedbackFormUrl("")).toEqual({ status: "missing", url: null });
    expect(getFeedbackUrl("")).toBeNull();
  });

  it("rejects both previous provider hosts", () => {
    expect(validateFeedbackFormUrl("https://forms.gle/opaqueToken")).toEqual({
      status: "invalid",
      url: null,
    });
    expect(validateFeedbackFormUrl("https://docs.google.com/forms/d/e/example/viewform")).toEqual({
      status: "invalid",
      url: null,
    });
  });

  it("does not construct URLs from private application fields", () => {
    const source = readFileSync("components/feedback/feedback-link.tsx", "utf8");
    for (const forbidden of [
      "searchParams",
      "journeyId",
      "userId",
      "partnerId",
      "inviteCode",
      "answerId",
      "sessionId",
      "comparisonResult",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("has complete English and French handoff copy without raw keys", () => {
    for (const locale of ["en", "fr"] as const) {
      const dictionary = getDictionary(locale);
      for (const key of [
        "controlled.title",
        "controlled.body",
        "feedback.action",
        "feedback.hosted",
        "feedback.unavailable",
        "feedback.newTab",
      ] as const) {
        expect(dictionary[key]).toBeTruthy();
        expect(dictionary[key]).not.toBe(key);
      }
    }
  });
});
