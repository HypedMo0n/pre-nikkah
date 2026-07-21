import { z } from "zod";

export const answerInputSchema = z.object({
  questionId: z.string().uuid(),
  value: z.string().max(4000),
  importance: z.enum(["flexible", "important", "essential", "non_negotiable"]).optional(),
  discussionPreference: z.enum(["together", "professional", "outside_app"]).optional(),
});

export const answerOptionsSchema = z.array(z.object({
  id: z.string(),
  label: z.string(),
}));