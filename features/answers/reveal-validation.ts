import { z } from "zod";

export const revealSchema = z.object({
  questionId: z.string().uuid(),
  revealed: z.enum(["true", "false"]),
});
