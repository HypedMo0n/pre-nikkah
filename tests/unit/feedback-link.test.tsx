// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FeedbackHandoff } from "@/components/feedback/feedback-link";

const approvedUrl = "https://www.cognitoforms.com/PreNikah/PreNikahAlphaFeedback2";

afterEach(cleanup);

describe("feedback completion UI", () => {
  it("renders the configured English link with safe new-tab attributes", () => {
    render(<FeedbackHandoff locale="en" url={approvedUrl} />);

    const link = screen.getByRole("link", { name: /share feedback/i });
    expect(link).toHaveAttribute("href", approvedUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.getAttribute("href")).not.toContain("?");
    expect(link.getAttribute("href")).not.toContain("#");
  });

  it("renders natural French copy", () => {
    render(<FeedbackHandoff locale="fr" url={approvedUrl} />);
    expect(screen.getByRole("link", { name: /donner mon avis/i })).toBeVisible();
  });

  it.each(["en", "fr"] as const)("fails safely for missing or invalid %s configuration", (locale) => {
    render(<FeedbackHandoff locale={locale} url={null} />);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
