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

function stages(answers: TopicAnswerRecord[] = [], discussions: TopicDiscussionRecord[] = []) {
  return buildTopicStages({ topics, questions, answers, discussions, progress: [], currentUserId: "user-a" });
}

describe("topic stage progression", () => {
  it("keeps a newly connected journey as not started with Begin-ready metrics", () => {
    const summaries = stages();
    expect(selectCurrentTopic(summaries)?.topic.slug).toBe("communication");
    expect(summaries[0].stage).toBe("not_started");
    expect(calculateJourneyMetrics(summaries)).toEqual({ overallCompletionPercentage: 0, questionsCompletedTogether: 0, sharedFoundationsDiscovered: 0, topicsCompleted: 0 });
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
    const summaries = stages([
      answer("topic-1-q1", "user-a"), answer("topic-1-q2", "user-a"), answer("topic-1-q1", "user-b"), answer("topic-1-q2", "user-b"),
      answer("topic-2-q1", "user-a"), answer("topic-2-q1", "user-b"),
    ], [{ topic_id: "topic-1", question_id: "topic-1-q1", status: "discussed", updated_at: "2026-07-20T00:00:00.000Z" }]);
    expect(calculateJourneyMetrics(summaries)).toEqual({ topicsCompleted: 1, questionsCompletedTogether: 3, sharedFoundationsDiscovered: 1, overallCompletionPercentage: 25 });
  });

  it("limits dashboard previews to three unanswered prompts", () => {
    const manyQuestions = [...questions, { id: "topic-1-q3", topic_id: "topic-1", text: "Third", type: "text", order_index: 3 }, { id: "topic-1-q4", topic_id: "topic-1", text: "Fourth", type: "text", order_index: 4 }];
    const summaries = buildTopicStages({ topics, questions: manyQuestions, progress: [], answers: [answer("topic-1-q1", "user-a")], discussions: [], currentUserId: "user-a" });
    expect(summaries[0].unansweredQuestions.map((question) => question.id)).toEqual(["topic-1-q2", "topic-1-q3", "topic-1-q4"]);
  });
});
