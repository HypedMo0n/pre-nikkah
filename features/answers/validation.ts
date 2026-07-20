import { z } from "zod";

export const answerInputSchema = z.object({
  questionId: z.string().uuid(),
  value: z.string().max(4000),
});

export const answerOptionsSchema = z.array(z.object({
  id: z.string(),
  label: z.string(),
}));
