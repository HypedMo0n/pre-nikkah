import { describe, expect, it } from "vitest";

import { activeDashboardTopics, buildTopicStages, calculateJourneyMetrics, selectCurrentTopic, type TopicAnswerRecord, type TopicDiscussionRecord } from "../../features/topics/stages";

const topics = [
  { id: "topic-1", slug: "communication", name: "Communication", order_index: 1 },
  { id: "topic-2", slug: "family", name: "Family", order_index: 2 },
  { id: "topic-3", slug: "money", name: "Money", order_index: 3 },
  { id: "topic-4", slug: "future", name: "Future", order_index: 4 },
];
const questions = topics.flatMap((topic) => [
  { id: `${topic.id}-q1`, topic_id: topic.id, text: `${topic.name} question 1`, type: "text", order_index: 1 },
  { id: `${topic.id}-q2`, topic_id: topic.id, text: `${topic.name} question 2`, type: "text", order_index: 2 },
]);
const answer = (question_id: string, user_id: string) => ({ question_id, user_id, questions: { topic_id: question_id.split("-q")[0] } });

function input(answers: TopicAnswerRecord[] = [], discussions: TopicDiscussionRecord[] = []) {
  return { topics, questions, answers, discussions, progress: [], currentUserId: "user-a" };
}

function stages(answers: TopicAnswerRecord[] = [], discussions: TopicDiscussionRecord[] = []) {
  return buildTopicStages(input(answers, discussions));
}

describe("topic stage progression", () => {
  it("keeps a newly connected journey as not started with Begin-ready metrics", () => {
    const summaries = stages();
    expect(selectCurrentTopic(summaries)?.topic.slug).toBe("communication");
    expect(summaries[0].stage).toBe("not_started");
    expect(calculateJourneyMetrics(input())).toEqual({ overallCompletionPercentage: 0, questionsCompletedTogether: 0, sharedFoundationsDiscovered: 0, topicsCompleted: 0 });
  });

  it("moves from in progress to waiting, ready, completed, and then advances", () => {
    expect(stages([answer("topic-1-q1", "user-a")])[0].stage).toBe("in_progress");
    expect(stages([answer("topic-1-q1", "user-a"), answer("topic-1-q2", "user-a")])[0].stage).toBe("waiting_for_partner");
    const bothDone = [answer("topic-1-q1", "user-a"), answer("topic-1-q2", "user-a"), answer("topic-1-q1", "user-b"), answer("topic-1-q2", "user-b")];
    expect(stages(bothDone)[0].stage).toBe("ready_to_discuss");
    const completed = stages(bothDone, [{ topic_id: "topic-1", question_id: "topic-1-q1", status: "discussed", updated_at: "2026-07-20T00:00:00.000Z" }]);
    expect(completed[0].stage).toBe("completed");
    expect(selectCurrentTopic(completed)?.topic.slug).toBe("family");
    expect(activeDashboardTopics(completed).map((summary) => summary.topic.slug)).toEqual(["family", "money", "future"]);
  });

  it("calculates journey metrics without exposing answers", () => {
    // Whole-journey aggregates are allowed to span every topic: they say the
    // couple is progressing without attributing progress to a named topic.
    const journey = input([
      answer("topic-1-q1", "user-a"), answer("topic-1-q2", "user-a"), answer("topic-1-q1", "user-b"), answer("topic-1-q2", "user-b"),
      answer("topic-2-q1", "user-a"), answer("topic-2-q1", "user-b"),
    ], [{ topic_id: "topic-1", question_id: "topic-1-q1", status: "discussed", updated_at: "2026-07-20T00:00:00.000Z" }]);
    expect(calculateJourneyMetrics(journey)).toEqual({ topicsCompleted: 1, questionsCompletedTogether: 3, sharedFoundationsDiscovered: 1, overallCompletionPercentage: 25 });
  });

  it("keeps per-topic partner progress out of every topic but the current one", () => {
    // topic-1 finished and discussed, so topic-2 is the current shared topic.
    // topic-3 is fully answered by both; topic-4 only by the partner.
    const summaries = stages([
      answer("topic-1-q1", "user-a"), answer("topic-1-q2", "user-a"), answer("topic-1-q1", "user-b"), answer("topic-1-q2", "user-b"),
      answer("topic-2-q1", "user-a"),
      answer("topic-3-q1", "user-a"), answer("topic-3-q2", "user-a"), answer("topic-3-q1", "user-b"), answer("topic-3-q2", "user-b"),
      answer("topic-4-q1", "user-b"),
    ], [{ topic_id: "topic-1", question_id: "topic-1-q1", status: "discussed", updated_at: "2026-07-20T00:00:00.000Z" }]);

    // The current topic keeps its partner detail: this is the one topic the
    // couple is working through together.
    expect(summaries[1].isCurrent).toBe(true);
    expect(summaries[1].partnerCompletedCount).toBe(0);

    // A non-current topic both partners finished must not report that the
    // partner finished it, so ready_to_discuss collapses to your_part_done.
    expect(summaries[2].stage).toBe("your_part_done");

    // A topic only the partner has touched must look untouched, otherwise the
    // in_progress label reveals which subject they went to on their own.
    expect(summaries[3].stage).toBe("not_started");

    for (const summary of summaries.filter((item) => !item.isCurrent)) {
      expect(summary.partnerCompletedCount).toBeNull();
      expect(summary.bothCompletedCount).toBeNull();
      expect(summary.completionPercentage).toBeNull();
      expect(["waiting_for_partner", "ready_to_discuss"]).not.toContain(summary.stage);
    }
  });

  it("collapses waiting_for_partner to your_part_done outside the current topic", () => {
    // The exact leak from the scope document: this user finished a sensitive
    // topic ahead of their partner, and must not be told the partner has not.
    const summaries = stages([
      answer("topic-1-q1", "user-a"), answer("topic-1-q2", "user-a"), answer("topic-1-q1", "user-b"), answer("topic-1-q2", "user-b"),
      answer("topic-2-q1", "user-a"),
      answer("topic-4-q1", "user-a"), answer("topic-4-q2", "user-a"),
    ], [{ topic_id: "topic-1", question_id: "topic-1-q1", status: "discussed", updated_at: "2026-07-20T00:00:00.000Z" }]);

    expect(summaries[3].stage).toBe("your_part_done");
    expect(summaries[3].partnerCompletedCount).toBeNull();
    // Their own progress stays visible: the collapse hides the partner, not the user.
    expect(summaries[3].currentUserCompletedCount).toBe(2);
  });

  it("limits dashboard previews to three unanswered prompts", () => {
    const manyQuestions = [...questions, { id: "topic-1-q3", topic_id: "topic-1", text: "Third", type: "text", order_index: 3 }, { id: "topic-1-q4", topic_id: "topic-1", text: "Fourth", type: "text", order_index: 4 }];
    const summaries = buildTopicStages({ topics, questions: manyQuestions, progress: [], answers: [answer("topic-1-q1", "user-a")], discussions: [], currentUserId: "user-a" });
    expect(summaries[0].unansweredQuestions.map((question) => question.id)).toEqual(["topic-1-q2", "topic-1-q3", "topic-1-q4"]);
  });
});
