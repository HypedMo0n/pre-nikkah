import { z } from "zod";

export const displayNameSchema = z.object({
  privateDisplayName: z.string().trim().max(60),
});

export const closeJourneySchema = z.object({ confirmation: z.literal("CLOSE") });
