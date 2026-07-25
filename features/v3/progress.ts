import type { TopicProgress } from "./types";

export type TopicStage =
  | "not_started"
  | "in_progress"
  | "waiting"
  | "ready"
  | "discussed";

export function getTopicStage(
  progress: TopicProgress,
  discussedQuestionIds: ReadonlySet<string>,
  topicQuestionIds: readonly string[],
): TopicStage {
  if (progress.own === 0 && progress.partner === 0) return "not_started";
  if (progress.own < progress.total) return "in_progress";
  if (progress.partner < progress.total || progress.together < progress.total) {
    return "waiting";
  }
  return topicQuestionIds.every((id) => discussedQuestionIds.has(id))
    ? "discussed"
    : "ready";
}
