import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const seed = readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");
const topicInsert = seed
  .split("insert into public.topics")[1]
  .split("on conflict (id) do update")[0];
const questionInsert = seed
  .split("insert into public.questions")[1]
  .split("on conflict (id) do update")[0];

const expectedTopics = [
  ["communication-and-conflict", 1, "00000000-0000-4000-8000-000000000105", 7],
  ["faith-and-religious-practice", 2, "00000000-0000-4000-8000-000000000101", 7],
  ["family-boundaries-and-involvement", 3, "00000000-0000-4000-8000-000000000103", 7],
  ["living-arrangements", 4, "00000000-0000-4000-8000-000000000106", 6],
  ["household-roles", 5, "00000000-0000-4000-8000-000000000107", 6],
  ["finances-and-debt", 6, "00000000-0000-4000-8000-000000000102", 8],
  ["children-and-parenting", 7, "00000000-0000-4000-8000-000000000104", 7],
  ["careers-education-and-time", 8, "00000000-0000-4000-8000-000000000109", 6],
  ["marriage-contract-and-nikah", 9, "00000000-0000-4000-8000-000000000110", 6],
  ["health-and-wellbeing", 10, "00000000-0000-4000-8000-000000000111", 6],
  ["intimacy-and-closeness", 11, "00000000-0000-4000-8000-000000000112", 5],
  ["dealbreakers", 12, "00000000-0000-4000-8000-000000000108", 1],
] as const;

describe("canonical topic seed", () => {
  it("contains the approved twelve-topic sequence exactly once", () => {
    // Rows are compared by order_index, not by their position in the file: the
    // seed lists dealbreakers first so it vacates order_index 8 before another
    // row claims it, since topics.order_index is unique and not deferrable.
    const topicRows = Array.from(
      topicInsert.matchAll(
        /\(\s*'[^']+',\s*'([^']+)',\s*'[^']+',\s*'[^']+',\s*\d+,\s*(\d+),\s*true\s*\)/g,
      ),
      (match) => [match[1], Number(match[2])] as [string, number],
    ).sort((left, right) => left[1] - right[1]);

    expect(topicRows).toEqual(expectedTopics.map(([slug, order]) => [slug, order]));
  });

  it("seeds the expected question count for every topic", () => {
    const counts = Object.fromEntries(
      expectedTopics.map(([slug, , topicId, expectedCount]) => [
        slug,
        {
          actual: questionInsert.split(`'${topicId}'`).length - 1,
          expected: expectedCount,
        },
      ]),
    );

    expect(counts).toEqual(
      Object.fromEntries(
        expectedTopics.map(([slug, , , expected]) => [slug, { actual: expected, expected }]),
      ),
    );
    expect(Object.values(counts).reduce((total, count) => total + count.actual, 0)).toBe(72);
  });

  it("keeps the opener low sensitivity and the final prompt private and never compared", () => {
    const communicationRows = questionInsert.match(
      /'10000000-0000-4000-8000-000000000501'[\s\S]*?'10000000-0000-4000-8000-000000000502'[\s\S]*?true\s*\n\s*\)/,
    )?.[0];
    expect(communicationRows).toBeDefined();
    expect(communicationRows?.match(/'standard'/g)).toHaveLength(2);

    const dealbreakersRow = questionInsert.match(
      /'10000000-0000-4000-8000-000000000801'[\s\S]*?'professional_discussion',\s*'never_compare',\s*false,\s*1,\s*true/,
    )?.[0];
    expect(dealbreakersRow).toBeDefined();
    expect(dealbreakersRow).toContain("This answer is never compared or revealed.");
  });

  it("uses stable option IDs and role-neutral household choices", () => {
    for (const optionId of [
      "talk_right_away",
      "space_then_talk",
      "write_first",
      "depends_on_situation",
      "own_place_right_away",
      "family_then_own_place",
      "shared_evenly",
      "by_strengths",
      "by_availability",
      "agree_and_revisit",
    ]) {
      expect(questionInsert).toContain(`"id":"${optionId}"`);
    }
  });
});
