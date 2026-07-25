import { z } from "zod";

export const questionActionSchema = z.object({
  questionId: z.string().uuid(),
});

export const addSharedNoteSchema = z.object({
  questionId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});
