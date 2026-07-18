import type { QuestionSensitivity, QuestionType } from "@/types/domain";

export type CadenceSensitivity = "low" | "medium" | "high";
export type CadenceEffort = "quick" | "reflective" | "deep";
export type CadenceFormat = "single_choice" | "scale" | "free_text";

export type CadenceQuestion = {
  id: string;
  type: QuestionType;
  sensitivity: QuestionSensitivity;
  order_index: number;
};

export type QuestionCadence = {
  order: number;
  sensitivity: CadenceSensitivity;
  effort: CadenceEffort;
  format: CadenceFormat;
  section: "opening" | "exploration" | "reflection";
  pauseAfter: boolean;
  recommendedBreakAfter: boolean;
};

const formatByType: Record<QuestionType, CadenceFormat> = {
  single: "single_choice",
  scale: "scale",
  text: "free_text",
};

const sensitivityRank: Record<QuestionSensitivity, CadenceSensitivity> = {
  standard: "low",
  sensitive: "medium",
  professional_discussion: "high",
};

function effortFor(question: CadenceQuestion): CadenceEffort {
  if (question.type === "text" || question.sensitivity === "professional_discussion") {
    return "deep";
  }
  return question.sensitivity === "sensitive" ? "reflective" : "quick";
}

/**
 * Produces a deterministic reflection order without changing comparison rules.
 * The lowest-order standard question opens the topic, and a standard question
 * is pulled forward when it would otherwise follow a high-sensitivity prompt.
 */
export function sequenceQuestionsForCadence<T extends CadenceQuestion>(
  questions: readonly T[],
): T[] {
  const remaining = [...questions].sort(
    (left, right) => left.order_index - right.order_index,
  );
  const result: T[] = [];

  const lowPressureIndex = remaining.findIndex(
    (question) => sensitivityRank[question.sensitivity] === "low",
  );
  if (lowPressureIndex >= 0) {
    result.push(remaining.splice(lowPressureIndex, 1)[0]);
  }

  while (remaining.length) {
    const previous = result.at(-1);
    const previousWasHigh =
      previous && sensitivityRank[previous.sensitivity] === "high";
    const nextLowIndex = previousWasHigh
      ? remaining.findIndex(
          (question) => sensitivityRank[question.sensitivity] !== "high",
        )
      : -1;
    result.push(remaining.splice(nextLowIndex >= 0 ? nextLowIndex : 0, 1)[0]);
  }

  return result;
}

export function buildQuestionCadence(
  question: CadenceQuestion,
  order: number,
  total: number,
): QuestionCadence {
  const sensitivity = sensitivityRank[question.sensitivity];
  const effort = effortFor(question);
  const oneBasedOrder = order + 1;
  return {
    effort,
    format: formatByType[question.type],
    order: oneBasedOrder,
    pauseAfter: sensitivity === "high" || effort === "deep",
    recommendedBreakAfter:
      oneBasedOrder >= 5 && oneBasedOrder <= 8 && oneBasedOrder === total,
    section:
      oneBasedOrder === 1
        ? "opening"
        : oneBasedOrder === total || effort === "deep"
          ? "reflection"
          : "exploration",
    sensitivity,
  };
}

export function validateCadenceSequence(questions: readonly CadenceQuestion[]) {
  const ordered = sequenceQuestionsForCadence(questions);
  const cadence = ordered.map((question, index) =>
    buildQuestionCadence(question, index, ordered.length),
  );
  const beginsLowPressure = cadence.length === 0 || cadence[0].sensitivity === "low";
  const consecutiveHighSensitivity = cadence.some(
    (item, index) =>
      index > 0 &&
      item.sensitivity === "high" &&
      cadence[index - 1].sensitivity === "high",
  );
  const breakPlacementValid =
    cadence.length < 5 ||
    cadence.some(
      (item) =>
        item.recommendedBreakAfter && item.order >= 5 && item.order <= 8,
    );

  return {
    beginsLowPressure,
    breakPlacementValid,
    consecutiveHighSensitivity,
    valid:
      beginsLowPressure &&
      !consecutiveHighSensitivity &&
      breakPlacementValid,
  };
}
