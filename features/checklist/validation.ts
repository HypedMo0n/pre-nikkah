import { z } from "zod";

export const checklistItemSchema = z.object({
  checklistDefinitionId: z.string().uuid(),
  done: z.enum(["true", "false"]),
});
