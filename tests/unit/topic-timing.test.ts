import { describe, expect, it } from "vitest";

import { estimateTopicMinutes, QUESTION_SECONDS } from "../../features/topics/timing";

describe("provisional topic timing", () => {
  it("centralizes per-type estimates and rounds up", () => {
    expect(QUESTION_SECONDS).toEqual({ single: 35, scale: 25, text: 120 });
    expect(estimateTopicMinutes(["single"])).toBe(2);
    expect(estimateTopicMinutes(["single", "scale", "text"])).toBe(3);
  });
});
