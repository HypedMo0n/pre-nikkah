import { z } from "zod";

export const answerSchema = z.object({
  spaceId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionKey: z.string().regex(/^[a-z0-9]+$/),
  importance: z.enum(["low", "medium", "high"]),
  privateNote: z.string().trim().max(5000).optional(),
});

export const sharedNoteSchema = z.object({
  spaceId: z.string().uuid(),
  questionId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  preferredLocale: z.enum(["en", "fr"]),
});

export const spaceQuestionSchema = z.object({
  spaceId: z.string().uuid(),
  questionId: z.string().uuid(),
});

export const uuidSchema = z.string().uuid();
