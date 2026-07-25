import { describe, expect, it } from "vitest";

import { getTopicStage } from "@/features/v3/progress";

const base = {
  topicId: "topic",
  own: 0,
  partner: 0,
  total: 6,
  together: 0,
};
const questions = ["1", "2", "3", "4", "5", "6"];

describe("topic progress stages", () => {
  it("starts privately and then waits without exposing exact answers", () => {
    expect(getTopicStage(base, new Set(), questions)).toBe("not_started");
    expect(
      getTopicStage({ ...base, own: 3 }, new Set(), questions),
    ).toBe("in_progress");
    expect(
      getTopicStage({ ...base, own: 6, partner: 2 }, new Set(), questions),
    ).toBe("waiting");
  });

  it("becomes ready only after all comparisons are server-ready", () => {
    expect(
      getTopicStage(
        { ...base, own: 6, partner: 6, together: 6 },
        new Set(),
        questions,
      ),
    ).toBe("ready");
  });

  it("is discussed only after every topic question is marked", () => {
    expect(
      getTopicStage(
        { ...base, own: 6, partner: 6, together: 6 },
        new Set(questions),
        questions,
      ),
    ).toBe("discussed");
  });
});
