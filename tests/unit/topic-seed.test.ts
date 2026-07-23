import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const seed = readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");

function jsonbLiterals(source: string) {
  return Array.from(source.matchAll(/'(\[[\s\S]*?\])'::jsonb/g), (match) => match[1]);
}

describe("v3 seed content", () => {
  it("seeds exactly twelve topics", () => {
    const topicBlock = seed.split("insert into public.topics")[1].split("values")[1].split("on conflict")[0];
    const topicRows = topicBlock.match(/^\s{2}\('/gm) ?? [];
    expect(topicRows).toHaveLength(12);
  });

  it("seeds exactly seventy-two questions", () => {
    const questionBlock = seed.split("insert into public.questions")[1].split("on conflict")[0];
    const questionRows = questionBlock.match(/^\s{2}\('/gm) ?? [];
    expect(questionRows).toHaveLength(72);
  });

  it("defaults dealbreakers to high importance and every other topic to null", () => {
    const topicBlock = seed.split("insert into public.topics")[1].split("values")[1].split("on conflict")[0];
    const dealbreakersRow = topicBlock.split("\n").find((line) => line.includes("'dealbreakers'"));
    expect(dealbreakersRow).toContain("'high'");

    const otherTopicRows = topicBlock
      .split("\n")
      .filter((line) => line.trim().startsWith("(") && !line.includes("'dealbreakers'"));
    expect(otherTopicRows.length).toBe(11);
    for (const row of otherTopicRows) {
      expect(row).toMatch(/,\s*null\)/);
    }
  });

  it("applies the topic-level importance override to every question in that topic", () => {
    // Regression coverage: topics.default_importance = 'high' for
    // dealbreakers was stored but never actually applied to each
    // question's own importance_default column on an earlier generation
    // of this file — the column the answer screen actually reads.
    const questionBlock = seed.split("insert into public.questions")[1].split("on conflict")[0];
    const dealbreakersQuestionIds = [
      "deal-01",
      "deal-02",
      "deal-03",
      "deal-04",
      "deal-05",
      "deal-06",
    ];
    const questionRows = questionBlock.split(/\n  \(/).slice(1);
    let dealbreakersRowCount = 0;
    for (const row of questionRows) {
      const isDealbreakers = dealbreakersQuestionIds.some((key) => row.includes(`'${key}'`));
      if (isDealbreakers) {
        dealbreakersRowCount += 1;
        expect(row).toMatch(/\]'::jsonb, 'high',/);
      } else {
        expect(row).toMatch(/\]'::jsonb, 'medium',/);
      }
    }
    expect(dealbreakersRowCount).toBe(6);
  });

  it("gives every question three to five options with a non-empty cluster", () => {
    const optionSets = jsonbLiterals(seed).map((raw) => JSON.parse(raw) as { key: string; cluster: string }[]);
    expect(optionSets).toHaveLength(72);
    for (const options of optionSets) {
      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options.length).toBeLessThanOrEqual(5);
      const keys = new Set(options.map((option) => option.key));
      expect(keys.size).toBe(options.length);
      for (const option of options) {
        expect(option.cluster.length).toBeGreaterThan(0);
      }
    }
  });

  it("never asks the answerer to rate their own religiosity", () => {
    // §6.1: "Never ask anyone to rate their own religiosity."
    expect(seed).not.toMatch(/how practising are you/i);
    expect(seed).not.toMatch(/rate your (?:religious practice|religiosity)/i);
  });

  it("stays within the twelve seeded topics — intimacy and divorce are deferred", () => {
    // §6: those two topics are explicitly out of scope for this version.
    const topicBlock = seed.split("insert into public.topics")[1].split("values")[1].split("on conflict")[0];
    expect(topicBlock).not.toMatch(/'intimacy/i);
    expect(topicBlock).not.toMatch(/'divorce/i);
  });
});
