import type { ArcColor } from "./path-node";

export type TopicProgress = {
  topicId: string;
  slug: string;
  title: string;
  mine: number;
  partner: number;
  total: number;
  discussed: number;
  discussedAt: string | null;
};

export type TopicProgressState = TopicProgress & {
  leftDone: boolean;
  rightDone: boolean;
  isDiscussed: boolean;
  left: ArcColor;
  right: ArcColor;
};

// §7.10's state table is binary per side (a topic is "done" for you once
// every question in it is answered, not fractionally) — the amber right
// arc is reserved for the one case worth a nudge: your partner finished
// this topic and you have not.
export function deriveTopicState(progress: TopicProgress): TopicProgressState {
  if (progress.total === 0) {
    return { ...progress, isDiscussed: false, left: "hairline", leftDone: false, right: "hairline", rightDone: false };
  }
  const leftDone = progress.mine >= progress.total;
  const rightDone = progress.partner >= progress.total;
  const isDiscussed = progress.discussed >= progress.total;
  if (isDiscussed) {
    return { ...progress, isDiscussed, left: "green", leftDone, right: "green", rightDone };
  }
  return {
    ...progress,
    isDiscussed,
    left: leftDone ? "green" : "hairline",
    leftDone,
    right: rightDone ? (leftDone ? "green" : "amber") : "hairline",
    rightDone,
  };
}
