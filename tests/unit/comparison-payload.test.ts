import { describe, expect, it } from "vitest";

import { countQuestionsWorthDiscussing, questionComparisonSchema } from "../../features/comparisons/types";

const questionId = "10000000-0000-4000-8000-000000000101";

describe("safe comparison payload", () => {
  it("rejects an unrevealed non-null partner value", () => {
    expect(questionComparisonSchema.safeParse({ status: "ready", question_id: questionId, bucket: "aligned", own_answer: "mine", own_answer_revealed: false, partner_answer_revealed: false, partner_answer: "must-not-leak" }).success).toBe(false);
  });

  it("accepts a partner value only with answer-specific reveal metadata", () => {
    expect(questionComparisonSchema.safeParse({ status: "ready", question_id: questionId, bucket: "worth_discussing", own_answer: "mine", own_answer_revealed: false, partner_answer_revealed: true, partner_answer: "shared" }).success).toBe(true);
  });

  it("does not let one question's reveal change another payload", () => {
    const first = questionComparisonSchema.parse({ status: "ready", question_id: questionId, bucket: "aligned", own_answer: 4, own_answer_revealed: false, partner_answer_revealed: true, partner_answer: 4 });
    const second = questionComparisonSchema.parse({ status: "ready", question_id: "10000000-0000-4000-8000-000000000102", bucket: "aligned", own_answer: 3, own_answer_revealed: false, partner_answer_revealed: false, partner_answer: null });
    expect(first.partner_answer_revealed).toBe(true);
    expect(second.partner_answer_revealed).toBe(false);
  });

  it("counts questions rather than topics", () => {
    expect(countQuestionsWorthDiscussing([{ aligned: 2, worthDiscussing: 3, possibleConcern: 0, waiting: 1 }, { aligned: 1, worthDiscussing: 2, possibleConcern: 1, waiting: 0 }])).toBe(5);
  });
});
