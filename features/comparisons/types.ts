import { z } from "zod";

const bucketSchema = z.enum(["aligned", "worth_discussing", "possible_concern"]);

const waitingSchema = z.object({
  status: z.enum(["waiting_for_you", "waiting_for_partner"]),
  question_id: z.string().uuid(),
  bucket: z.null(),
  own_answer: z.null(),
  own_answer_revealed: z.null(),
  partner_answer_revealed: z.null(),
  partner_answer: z.null(),
});

const readyPrivateSchema = z.object({
  status: z.literal("ready"),
  question_id: z.string().uuid(),
  bucket: bucketSchema,
  own_answer: z.unknown(),
  own_answer_revealed: z.boolean(),
  partner_answer_revealed: z.literal(false),
  partner_answer: z.null(),
});

const readySharedSchema = z.object({
  status: z.literal("ready"),
  question_id: z.string().uuid(),
  bucket: bucketSchema,
  own_answer: z.unknown(),
  own_answer_revealed: z.boolean(),
  partner_answer_revealed: z.literal(true),
  partner_answer: z.unknown().refine((value) => value !== null && value !== undefined),
});

export const questionComparisonSchema = z.union([waitingSchema, readyPrivateSchema, readySharedSchema]);
export type QuestionComparison = z.infer<typeof questionComparisonSchema>;

export const topicComparisonSummarySchema = z.object({
  aligned: z.number().int().nonnegative(),
  worthDiscussing: z.number().int().nonnegative(),
  possibleConcern: z.number().int().nonnegative(),
  waiting: z.number().int().nonnegative(),
});
export type TopicComparisonSummary = z.infer<typeof topicComparisonSummarySchema>;

export function countQuestionsWorthDiscussing(summaries: readonly TopicComparisonSummary[]) {
  return summaries.reduce((total, summary) => total + summary.worthDiscussing, 0);
}
