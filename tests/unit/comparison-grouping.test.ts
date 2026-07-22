import { describe, expect, it } from "vitest";

import { eligibleComparisonQuestionIds, groupComparisons } from "../../features/comparisons/grouping";
import type { QuestionComparison } from "../../features/comparisons/types";

const topics = [{ id: "topic-1", name: "Communication", order_index: 1 }, { id: "topic-2", name: "Family", order_index: 2 }];
const questions = [
  { id: "q1", text: "Ready", topic_id: "topic-1", order_index: 1 },
  { id: "q2", text: "One partner", topic_id: "topic-1", order_index: 2 },
  { id: "q3", text: "Reviewed", topic_id: "topic-2", order_index: 1 },
];
const ready = (question_id: string, bucket: QuestionComparison["bucket"]): QuestionComparison => ({ status: "ready", question_id, bucket: bucket!, own_answer: "redacted", own_answer_revealed: false, partner_answer_revealed: false, partner_answer: null });

describe("comparison grouping", () => {
  it("hides unanswered and one-partner-only questions", () => {
    expect([...eligibleComparisonQuestionIds([{ question_id: "q1", user_id: "a" }, { question_id: "q1", user_id: "b" }, { question_id: "q2", user_id: "a" }])]).toEqual(["q1"]);
  });

  it("splits both-completed questions into ready and reviewed groups without duplication", () => {
    const result = groupComparisons({
      topics,
      questions,
      answers: [{ question_id: "q1", user_id: "a" }, { question_id: "q1", user_id: "b" }, { question_id: "q2", user_id: "a" }, { question_id: "q3", user_id: "a" }, { question_id: "q3", user_id: "b" }],
      discussions: [{ question_id: "q3", topic_id: "topic-2", status: "discussed", updated_at: "2026-07-20T00:00:00.000Z" }],
      comparisons: new Map([["q1", ready("q1", "aligned")], ["q3", ready("q3", "worth_discussing")]]),
      currentTopicId: "topic-1",
    });
    expect(result.readyGroups).toHaveLength(1);
    expect(result.readyGroups[0].ready.map((row) => row.question.id)).toEqual(["q1"]);
    expect(result.reviewedGroups).toHaveLength(1);
    expect(result.reviewedGroups[0].reviewed.map((row) => row.question.id)).toEqual(["q3"]);
  });

  it("trusts the privacy-preserving RPC when RLS exposes only the current user's answer", () => {
    const result = groupComparisons({
      topics,
      questions,
      answers: [{ question_id: "q1", user_id: "a" }],
      discussions: [],
      comparisons: new Map([["q1", ready("q1", "aligned")]]),
      currentTopicId: "topic-1",
    });
    expect(result.readyGroups[0].ready.map((row) => row.question.id)).toEqual(["q1"]);
  });
});
