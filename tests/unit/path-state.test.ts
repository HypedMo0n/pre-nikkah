import { describe, expect, it } from "vitest";

import { deriveTopicState, type TopicProgress } from "../../components/path/topic-progress";

function progress(overrides: Partial<TopicProgress>): TopicProgress {
  return {
    discussed: 0,
    discussedAt: null,
    mine: 0,
    partner: 0,
    slug: "fixture",
    title: "Fixture topic",
    topicId: "fixture-topic",
    total: 6,
    ...overrides,
  };
}

describe("Path node state derivation (§7.10)", () => {
  it("renders both arcs as hairline when neither side has answered anything", () => {
    const state = deriveTopicState(progress({ mine: 0, partner: 0 }));
    expect(state.left).toBe("hairline");
    expect(state.right).toBe("hairline");
    expect(state.isDiscussed).toBe(false);
  });

  it("renders only your arc green when you alone have finished the topic", () => {
    const state = deriveTopicState(progress({ mine: 6, partner: 0 }));
    expect(state.left).toBe("green");
    expect(state.right).toBe("hairline");
  });

  it("renders the partner's arc amber, never green, when only they have finished", () => {
    const state = deriveTopicState(progress({ mine: 0, partner: 6 }));
    expect(state.left).toBe("hairline");
    expect(state.right).toBe("amber");
  });

  it("still renders amber for the partner's arc when your own progress is only partial", () => {
    const state = deriveTopicState(progress({ mine: 3, partner: 6 }));
    expect(state.left).toBe("hairline");
    expect(state.right).toBe("amber");
  });

  it("renders both arcs green once both sides have fully answered", () => {
    const state = deriveTopicState(progress({ mine: 6, partner: 6 }));
    expect(state.left).toBe("green");
    expect(state.right).toBe("green");
    expect(state.isDiscussed).toBe(false);
  });

  it("adds the center dot only once every question in the topic has been marked discussed", () => {
    const partiallyDiscussed = deriveTopicState(progress({ discussed: 3, mine: 6, partner: 6 }));
    expect(partiallyDiscussed.isDiscussed).toBe(false);

    const fullyDiscussed = deriveTopicState(progress({ discussed: 6, mine: 6, partner: 6 }));
    expect(fullyDiscussed.isDiscussed).toBe(true);
    expect(fullyDiscussed.left).toBe("green");
    expect(fullyDiscussed.right).toBe("green");
  });

  it("treats a topic with no active questions as untouched rather than dividing by zero", () => {
    const state = deriveTopicState(progress({ mine: 0, partner: 0, total: 0 }));
    expect(state.left).toBe("hairline");
    expect(state.right).toBe("hairline");
    expect(state.leftDone).toBe(false);
    expect(state.rightDone).toBe(false);
  });
});
