import type { TopicProgress } from "./types";

/**
 * `waiting` and `ready` both disclose whether the partner has finished a named
 * topic, so they are only ever produced for the space's current shared topic.
 * Every other topic collapses to `your_part_done`, which describes this user's
 * own side and nothing else.
 */
export type TopicStage =
  | "not_started"
  | "in_progress"
  | "your_part_done"
  | "waiting"
  | "ready"
  | "discussed";

/**
 * Full stage, including partner-derived states. Callers rendering a list of
 * topics must not use this directly; use `getVisibleTopicStage` so non-current
 * topics are collapsed.
 */
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

/**
 * Client-safe stage. Knowing that a partner has stalled on one particular
 * topic reveals which subject they are avoiding, so outside the current shared
 * topic the stage is derived from this user's own answers alone.
 *
 * `discussed` survives because it means both people answered *and* worked
 * through the topic together, which both already know.
 */
export function getVisibleTopicStage(
  progress: TopicProgress,
  discussedQuestionIds: ReadonlySet<string>,
  topicQuestionIds: readonly string[],
  isCurrent: boolean,
): TopicStage {
  const stage = getTopicStage(progress, discussedQuestionIds, topicQuestionIds);
  if (isCurrent || stage === "discussed") return stage;
  if (progress.own === 0) return "not_started";
  return progress.own < progress.total ? "in_progress" : "your_part_done";
}

/**
 * The couple's current shared topic: the first one they have not finished
 * together. This is the single definition of "current" behind every
 * partner-visibility decision, so the rule cannot drift between screens.
 * Returns null when every topic is discussed, in which case nothing is
 * partner-sensitive any more.
 */
export function getCurrentTopicId(
  topics: readonly { id: string }[],
  progress: readonly TopicProgress[],
  questions: readonly { id: string; topicId: string }[],
  discussedQuestionIds: ReadonlySet<string>,
): string | null {
  const current = topics.find((topic) => {
    const topicProgress = progress.find((item) => item.topicId === topic.id);
    if (!topicProgress) return true;
    const questionIds = questions
      .filter((question) => question.topicId === topic.id)
      .map((question) => question.id);
    return (
      getTopicStage(topicProgress, discussedQuestionIds, questionIds) !==
      "discussed"
    );
  });
  return current?.id ?? null;
}

/**
 * A topic row with every partner-derived count stripped unless the topic is the
 * current shared one. `partner` and `together` are both counts of what the
 * other person has done, so neither may travel per topic.
 */
export type VisibleTopicProgress = {
  topicId: string;
  own: number;
  total: number;
  partner: number | null;
  together: number | null;
};

export function toVisibleProgress(
  progress: TopicProgress,
  isCurrent: boolean,
): VisibleTopicProgress {
  return {
    topicId: progress.topicId,
    own: progress.own,
    total: progress.total,
    partner: isCurrent ? progress.partner : null,
    together: isCurrent ? progress.together : null,
  };
}
