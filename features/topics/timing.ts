import type { QuestionType } from "@/types/domain";

export const QUESTION_SECONDS: Readonly<Record<QuestionType, number>> = {
  single: 35,
  scale: 25,
  text: 120,
};

export function estimateTopicMinutes(types: readonly QuestionType[]) {
  const seconds = types.reduce((total, type) => total + QUESTION_SECONDS[type], 0);
  return Math.max(2, Math.ceil(seconds / 60));
}
