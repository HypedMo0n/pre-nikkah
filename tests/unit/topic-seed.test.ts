import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bank = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260724000200_question_bank_en.sql",
  ),
  "utf8",
);

describe("canonical question bank", () => {
  it("has twelve ordered topics and six questions per topic", () => {
    const topicIds = [
      ...bank.matchAll(
        /insert into public\.topics \(id, slug, order_index\) values \('([^']+)'/g,
      ),
    ].map((match) => match[1]);
    expect(topicIds).toHaveLength(12);
    for (const topicId of topicIds) {
      const escaped = topicId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(
        bank.match(
          new RegExp(
            `insert into public\\.questions \\([^\\n]+\\) values \\('[^']+', '[^']+', '${escaped}'`,
            "g",
          ),
        ),
      ).toHaveLength(6);
    }
  });

  it("forces every dealbreaker question to high importance", () => {
    const dealbreakerTopic =
      bank.match(
        /insert into public\.topics \(id, slug, order_index\) values \('([^']+)', 'dealbreakers'/,
      )?.[1] ?? "";
    const rows = [
      ...bank.matchAll(
        new RegExp(
          `insert into public\\.questions \\([^\\n]+\\) values \\('[^']+', '[^']+', '${dealbreakerTopic}', \\d+, '([^']+)'\\);`,
          "g",
        ),
      ),
    ];
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row[1] === "high")).toBe(true);
  });

  it("stores authored starters and structured options for every question", () => {
    expect(bank.match(/insert into public\.question_translations /g)).toHaveLength(72);
    expect(bank.match(/insert into public\.question_options /g)?.length).toBeGreaterThanOrEqual(216);
    expect(bank.match(/insert into public\.question_option_translations /g)?.length).toBeGreaterThanOrEqual(216);
  });
});
