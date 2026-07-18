import { describe, expect, it } from "vitest";

import {
  buildQuestionCadence,
  sequenceQuestionsForCadence,
  validateCadenceSequence,
  type CadenceQuestion,
} from "@/features/topics/cadence";

const questions: CadenceQuestion[] = [
  { id: "sensitive-first", order_index: 1, sensitivity: "sensitive", type: "single" },
  { id: "opening", order_index: 2, sensitivity: "standard", type: "scale" },
  { id: "high", order_index: 3, sensitivity: "professional_discussion", type: "text" },
  { id: "high-two", order_index: 4, sensitivity: "professional_discussion", type: "text" },
  { id: "bridge", order_index: 5, sensitivity: "standard", type: "single" },
  { id: "reflection", order_index: 6, sensitivity: "sensitive", type: "text" },
];

describe("question cadence", () => {
  it("starts with a low-pressure question and separates high-sensitivity prompts", () => {
    const ordered = sequenceQuestionsForCadence(questions);
    expect(ordered[0].id).toBe("opening");
    expect(ordered.map((question) => question.id)).toEqual([
      "opening",
      "sensitive-first",
      "high",
      "bridge",
      "high-two",
      "reflection",
    ]);
    expect(validateCadenceSequence(questions)).toEqual({
      beginsLowPressure: true,
      breakPlacementValid: true,
      consecutiveHighSensitivity: false,
      valid: true,
    });
  });

  it("maps current MVP formats and marks deep reflection without changing comparison", () => {
    expect(buildQuestionCadence(questions[2], 2, 6)).toMatchObject({
      effort: "deep",
      format: "free_text",
      pauseAfter: true,
      sensitivity: "high",
    });
  });

  it("places the optional break after a five-to-eight-question topic", () => {
    const cadence = questions.map((question, index) =>
      buildQuestionCadence(question, index, questions.length),
    );
    expect(cadence.at(-1)).toMatchObject({
      order: 6,
      recommendedBreakAfter: true,
    });
  });
});
