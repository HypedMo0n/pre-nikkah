import { z } from "zod";

export const discussionSchema = z.object({
  questionId: z.string().uuid(),
  sharedNote: z.string().trim().max(5000),
  status: z.enum(["discussing", "discussed"]),
});
