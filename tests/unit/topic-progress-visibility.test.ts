import { describe, expect, it } from "vitest";

import {
  getCurrentTopicId,
  getTopicStage,
  getVisibleTopicStage,
  toVisibleProgress,
} from "../../features/v3/progress";
import type { TopicProgress } from "../../features/v3/types";

const progress = (
  topicId: string,
  own: number,
  partner: number,
  together: number,
  total = 4,
): TopicProgress => ({ topicId, own, partner, total, together });

const topics = [
  { id: "t1" },
  { id: "t2" },
  { id: "t3" },
  { id: "t4" },
];
const questions = topics.flatMap((topic) => [
  { id: `${topic.id}-q1`, topicId: topic.id },
  { id: `${topic.id}-q2`, topicId: topic.id },
  { id: `${topic.id}-q3`, topicId: topic.id },
  { id: `${topic.id}-q4`, topicId: topic.id },
]);
const idsFor = (topicId: string) =>
  questions.filter((q) => q.topicId === topicId).map((q) => q.id);
const allDiscussed = (topicId: string) => new Set(idsFor(topicId));

describe("per-topic partner visibility", () => {
  it("keeps partner detail on the current shared topic", () => {
    const own = progress("t1", 4, 2, 2);
    expect(getVisibleTopicStage(own, new Set(), idsFor("t1"), true)).toBe(
      "waiting",
    );
    expect(toVisibleProgress(own, true)).toEqual({
      topicId: "t1",
      own: 4,
      total: 4,
      partner: 2,
      together: 2,
    });
  });

  it("collapses waiting to your_part_done outside the current topic", () => {
    // The exact leak: this user finished a sensitive topic ahead of their
    // partner and must not be told the partner has not.
    const own = progress("t3", 4, 1, 1);
    expect(getTopicStage(own, new Set(), idsFor("t3"))).toBe("waiting");
    expect(getVisibleTopicStage(own, new Set(), idsFor("t3"), false)).toBe(
      "your_part_done",
    );
  });

  it("collapses ready to your_part_done outside the current topic", () => {
    // ready means both finished, which still discloses that the partner did.
    const own = progress("t3", 4, 4, 4);
    expect(getTopicStage(own, new Set(), idsFor("t3"))).toBe("ready");
    expect(getVisibleTopicStage(own, new Set(), idsFor("t3"), false)).toBe(
      "your_part_done",
    );
  });

  it("shows a topic only the partner has touched as not started", () => {
    // Otherwise in_progress reveals which subject they went to on their own.
    const own = progress("t4", 0, 3, 0);
    expect(getTopicStage(own, new Set(), idsFor("t4"))).toBe("in_progress");
    expect(getVisibleTopicStage(own, new Set(), idsFor("t4"), false)).toBe(
      "not_started",
    );
  });

  it("keeps discussed, which both partners already know about", () => {
    const own = progress("t2", 4, 4, 4);
    expect(
      getVisibleTopicStage(own, allDiscussed("t2"), idsFor("t2"), false),
    ).toBe("discussed");
  });

  it("strips partner and together counts outside the current topic", () => {
    expect(toVisibleProgress(progress("t3", 4, 3, 3), false)).toEqual({
      topicId: "t3",
      own: 4,
      total: 4,
      partner: null,
      together: null,
    });
  });

  it("never emits a partner-revealing stage for a non-current topic", () => {
    const cases: TopicProgress[] = [
      progress("t3", 0, 0, 0),
      progress("t3", 2, 0, 0),
      progress("t3", 4, 0, 0),
      progress("t3", 4, 2, 2),
      progress("t3", 4, 4, 4),
      progress("t3", 0, 4, 0),
    ];
    for (const item of cases) {
      const stage = getVisibleTopicStage(item, new Set(), idsFor("t3"), false);
      expect(["waiting", "ready"]).not.toContain(stage);
    }
  });

  it("treats the first topic that is not discussed as current", () => {
    const rows = [
      progress("t1", 4, 4, 4),
      progress("t2", 1, 0, 0),
      progress("t3", 0, 0, 0),
      progress("t4", 0, 0, 0),
    ];
    const discussed = allDiscussed("t1");
    expect(getCurrentTopicId(topics, rows, questions, discussed)).toBe("t2");
  });

  it("returns no current topic once every topic is discussed", () => {
    const rows = topics.map((topic) => progress(topic.id, 4, 4, 4));
    const discussed = new Set(questions.map((question) => question.id));
    expect(getCurrentTopicId(topics, rows, questions, discussed)).toBeNull();
  });
});
