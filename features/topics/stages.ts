import type { FoundationLayerState } from "@/components/dashboard/foundation-visual";
import type { QuestionType } from "@/types/domain";

export type TopicStage = "not_started" | "in_progress" | "waiting_for_partner" | "ready_to_discuss" | "completed";

export type TopicStageTopic = { id: string; slug: string; name: string; blurb?: string | null; order_index: number };
export type TopicStageQuestion = { id: string; topic_id: string; text?: string | null; type?: QuestionType | string | null; order_index?: number | null };
export type TopicProgressRecord = { topic_id: string; user_id: string; completed_at: string | null };
export type TopicAnswerRecord = { question_id: string; user_id: string; questions?: { topic_id: string | null } | null };
export type TopicDiscussionRecord = { topic_id: string | null; question_id?: string | null; status: string | null; updated_at?: string | null };

export type TopicStageSummary = {
  topic: TopicStageTopic;
  stage: TopicStage;
  totalQuestionCount: number;
  currentUserCompletedCount: number;
  partnerCompletedCount: number;
  bothCompletedCount: number;
  discussionStatus: "not_started" | "discussing" | "discussed";
  completionPercentage: number;
  isCurrent: boolean;
  unansweredQuestions: TopicStageQuestion[];
};

export type JourneyMetrics = {
  topicsCompleted: number;
  questionsCompletedTogether: number;
  sharedFoundationsDiscovered: number;
  overallCompletionPercentage: number;
};

function buildAnswerIndex(answers: readonly TopicAnswerRecord[]) {
  const byTopicUser = new Map<string, Map<string, Set<string>>>();
  const byQuestion = new Map<string, Set<string>>();
  for (const answer of answers) {
    const topicId = answer.questions?.topic_id;
    if (!topicId) continue;
    if (!byTopicUser.has(topicId)) byTopicUser.set(topicId, new Map());
    const userMap = byTopicUser.get(topicId)!;
    if (!userMap.has(answer.user_id)) userMap.set(answer.user_id, new Set());
    userMap.get(answer.user_id)!.add(answer.question_id);
    if (!byQuestion.has(answer.question_id)) byQuestion.set(answer.question_id, new Set());
    byQuestion.get(answer.question_id)!.add(answer.user_id);
  }
  return { byTopicUser, byQuestion };
}

export function buildTopicStages(input: {
  topics: readonly TopicStageTopic[];
  questions: readonly TopicStageQuestion[];
  progress: readonly TopicProgressRecord[];
  answers: readonly TopicAnswerRecord[];
  discussions: readonly TopicDiscussionRecord[];
  currentUserId: string;
}): TopicStageSummary[] {
  const { byTopicUser, byQuestion } = buildAnswerIndex(input.answers);
  const questionMap = new Map<string, TopicStageQuestion[]>();
  for (const question of input.questions) {
    if (!questionMap.has(question.topic_id)) questionMap.set(question.topic_id, []);
    questionMap.get(question.topic_id)!.push(question);
  }
  for (const questions of questionMap.values()) questions.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const discussedTopics = new Set(input.discussions.filter((item) => item.topic_id && item.status === "discussed").map((item) => item.topic_id as string));
  const progressComplete = new Set(input.progress.filter((item) => item.completed_at).map((item) => `${item.topic_id}:${item.user_id}`));

  const summaries = input.topics.map((topic) => {
    const topicQuestions = questionMap.get(topic.id) ?? [];
    const totalQuestionCount = topicQuestions.length;
    const userMap = byTopicUser.get(topic.id) ?? new Map<string, Set<string>>();
    const currentUserCompletedCount = userMap.get(input.currentUserId)?.size ?? 0;
    const partnerCompletedCount = Math.max(0, ...[...userMap.entries()].filter(([userId]) => userId !== input.currentUserId).map(([, ids]) => ids.size));
    const bothCompletedCount = topicQuestions.filter((question) => (byQuestion.get(question.id)?.size ?? 0) >= 2).length;
    const currentUserTopicComplete = totalQuestionCount > 0 && (currentUserCompletedCount >= totalQuestionCount || progressComplete.has(`${topic.id}:${input.currentUserId}`));
    const partnerTopicComplete = totalQuestionCount > 0 && (partnerCompletedCount >= totalQuestionCount || input.progress.some((item) => item.topic_id === topic.id && item.user_id !== input.currentUserId && item.completed_at));
    const bothTopicComplete = currentUserTopicComplete && partnerTopicComplete;
    const discussionStatus = discussedTopics.has(topic.id) ? "discussed" : "not_started";
    const hasAnyProgress = currentUserCompletedCount > 0 || partnerCompletedCount > 0;
    const stage: TopicStage = bothTopicComplete && discussionStatus === "discussed"
      ? "completed"
      : bothTopicComplete
        ? "ready_to_discuss"
        : currentUserTopicComplete
          ? "waiting_for_partner"
          : hasAnyProgress
            ? "in_progress"
            : "not_started";
    const completionPercentage = totalQuestionCount === 0 ? 0 : Math.round((bothCompletedCount / totalQuestionCount) * 100);
    return {
      topic,
      stage,
      totalQuestionCount,
      currentUserCompletedCount,
      partnerCompletedCount,
      bothCompletedCount,
      discussionStatus,
      completionPercentage,
      isCurrent: false,
      unansweredQuestions: topicQuestions.filter((question) => !(userMap.get(input.currentUserId)?.has(question.id))).slice(0, 3),
    } satisfies TopicStageSummary;
  });

  const currentIndex = summaries.findIndex((summary) => summary.stage !== "completed");
  return summaries.map((summary, index) => ({ ...summary, isCurrent: index === currentIndex }));
}

export function selectCurrentTopic(stages: readonly TopicStageSummary[]) {
  return stages.find((summary) => summary.stage !== "completed") ?? null;
}

export function calculateJourneyMetrics(stages: readonly TopicStageSummary[]): JourneyMetrics {
  const topicsCompleted = stages.filter((summary) => summary.stage === "completed").length;
  const questionsCompletedTogether = stages.reduce((total, summary) => total + summary.bothCompletedCount, 0);
  const sharedFoundationsDiscovered = topicsCompleted;
  const totalMilestones = stages.length * 2;
  const completedMilestones = stages.reduce((total, summary) => total + (summary.bothCompletedCount === summary.totalQuestionCount && summary.totalQuestionCount > 0 ? 1 : 0) + (summary.stage === "completed" ? 1 : 0), 0);
  return {
    topicsCompleted,
    questionsCompletedTogether,
    sharedFoundationsDiscovered,
    overallCompletionPercentage: totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100),
  };
}

export function foundationLayersFromStages(stages: readonly TopicStageSummary[]): FoundationLayerState[] {
  return stages.map((summary) => summary.stage === "completed" ? "discussed" : summary.bothCompletedCount === summary.totalQuestionCount && summary.totalQuestionCount > 0 ? "completed" : "empty");
}

export function activeDashboardTopics(stages: readonly TopicStageSummary[], limit = 3) {
  return stages.filter((summary) => summary.stage !== "completed").slice(0, limit);
}

export function hasJourneyStarted(stages: readonly TopicStageSummary[]) {
  return stages.some((summary) => summary.currentUserCompletedCount > 0 || summary.partnerCompletedCount > 0 || summary.stage !== "not_started");
}
