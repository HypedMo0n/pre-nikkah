import { z } from "zod";

import { locales } from "@/lib/i18n/config";

export const accountDetailsSchema = z.object({
  locale: z.enum(locales),
  privateDisplayName: z.string().trim().max(80).optional().default(""),
  entryMode: z.enum(["create", "join"]),
  inviteCode: z.string().optional(),
});

export const relationshipStageSchema = z.object({
  locale: z.enum(locales),
  entryMode: z.enum(["create", "join"]),
  inviteCode: z.string().optional(),
  relationshipStage: z.enum([
    "getting_to_know_seriously",
    "families_involved",
    "engaged",
    "preparing_for_nikah",
    "other",
  ]),
});

export const pacePreferenceSchema = z.object({
  locale: z.enum(locales),
  entryMode: z.enum(["create", "join"]),
  inviteCode: z.string().optional(),
  preferredPace: z.enum(["gentle", "steady", "flexible"]),
});

export type OnboardingActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialOnboardingActionState: OnboardingActionState = {
  status: "idle",
};
