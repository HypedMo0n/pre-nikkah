import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("question page journey guard", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "[locale]", "(private)", "topics", "[slug]", "questions", "[questionId]", "page.tsx"), "utf8");

  it("checks connection state and current couple before rendering the answer form", () => {
    expect(source).toContain('supabase.rpc("get_connection_overview")');
    expect(source).toContain('supabase.rpc("current_couple_id")');
    expect(source).toContain('connectionStatus !== "active" || !coupleId');
    expect(source.indexOf('connectionStatus !== "active" || !coupleId')).toBeLessThan(source.indexOf('<AnswerForm'));
  });

  it("shows no-journey CTAs instead of an active answer form", () => {
    expect(source).toContain('d["answer.createJourney"]');
    expect(source).toContain('d["answer.joinInvite"]');
    expect(source).toContain('d["answer.resolveWaiting"]');
    expect(source).toContain('d["answer.returnDashboard"]');
  });
});
