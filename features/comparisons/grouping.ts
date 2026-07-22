import type { QuestionComparison } from "./types";

export type ComparisonTopic = { id: string; name: string; order_index: number };
export type ComparisonQuestion = { id: string; text: string; topic_id: string; order_index: number };
export type ComparisonAnswerRecord = { question_id: string; user_id: string };
export type ComparisonDiscussionRecord = { question_id: string | null; topic_id: string | null; status: string | null; updated_at?: string | null };

export type CompactComparisonRow = { question: ComparisonQuestion; bucket: "aligned" | "worth_discussing" | "possible_concern"; reviewedAt: string | null };
export type ComparisonTopicGroup = { topic: ComparisonTopic; ready: CompactComparisonRow[]; reviewed: CompactComparisonRow[] };

export function eligibleComparisonQuestionIds(answers: readonly ComparisonAnswerRecord[]) {
  const answerUsers = new Map<string, Set<string>>();
  for (const answer of answers) {
    if (!answerUsers.has(answer.question_id)) answerUsers.set(answer.question_id, new Set());
    answerUsers.get(answer.question_id)!.add(answer.user_id);
  }
  return new Set([...answerUsers.entries()].filter(([, users]) => users.size >= 2).map(([questionId]) => questionId));
}

export function groupComparisons(input: {
  topics: readonly ComparisonTopic[];
  questions: readonly ComparisonQuestion[];
  answers: readonly ComparisonAnswerRecord[];
  discussions: readonly ComparisonDiscussionRecord[];
  comparisons: ReadonlyMap<string, QuestionComparison>;
  currentTopicId?: string | null;
}): { readyGroups: ComparisonTopicGroup[]; reviewedGroups: ComparisonTopicGroup[] } {
  const reviewed = new Map(input.discussions.filter((discussion) => discussion.question_id && discussion.status === "discussed").map((discussion) => [discussion.question_id as string, discussion.updated_at ?? null]));
  const groups = input.topics.map((topic) => ({ topic, ready: [] as CompactComparisonRow[], reviewed: [] as CompactComparisonRow[] }));
  const byTopic = new Map(groups.map((group) => [group.topic.id, group]));

  for (const question of input.questions) {
    const comparison = input.comparisons.get(question.id);
    if (!comparison || comparison.status !== "ready") continue;
    const row = { question, bucket: comparison.bucket, reviewedAt: reviewed.get(question.id) ?? null } satisfies CompactComparisonRow;
    const group = byTopic.get(question.topic_id);
    if (!group) continue;
    if (reviewed.has(question.id)) group.reviewed.push(row);
    else group.ready.push(row);
  }

  for (const group of groups) {
    group.ready.sort((a, b) => a.question.order_index - b.question.order_index);
    group.reviewed.sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? "") || a.question.order_index - b.question.order_index);
  }

  const readyGroups = groups.filter((group) => group.ready.length > 0).sort((a, b) => {
    if (a.topic.id === input.currentTopicId) return -1;
    if (b.topic.id === input.currentTopicId) return 1;
    return a.topic.order_index - b.topic.order_index;
  });
  const reviewedGroups = groups.filter((group) => group.reviewed.length > 0).sort((a, b) => {
    const aLatest = a.reviewed[0]?.reviewedAt ?? "";
    const bLatest = b.reviewed[0]?.reviewedAt ?? "";
    return bLatest.localeCompare(aLatest) || a.topic.order_index - b.topic.order_index;
  });
  return { readyGroups, reviewedGroups };
}
