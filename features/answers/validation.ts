import { z } from "zod";

export const saveAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionKey: z.string().trim().min(1).max(20),
  importance: z.enum(["low", "medium", "high"]),
  // The dashed private-note field submits "" when left empty; store that as
  // null rather than an empty string, matching the column's own nullability.
  privateNote: z
    .string()
    .max(2000)
    .nullish()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    }),
});
