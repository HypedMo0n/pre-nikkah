import { z } from "zod";

export const deletionRequestSchema = z.object({
  confirmation: z.literal("DELETE"),
  password: z.string().min(8).max(128),
}).strict();

export function hasForbiddenDeletionTarget(entries: Iterable<[string, FormDataEntryValue]>) {
  for (const [key] of entries) {
    if (key === "userId" || key === "user_id" || key === "targetUserId" || key === "target_user_id") return true;
  }
  return false;
}
