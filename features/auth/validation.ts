import { z } from "zod";

import { locales } from "@/lib/i18n/config";

const localeSchema = z.enum(locales);
const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(8).max(128);

export const signUpSchema = z.object({
  locale: localeSchema,
  email: emailSchema,
  password: passwordSchema,
  privateDisplayName: z.string().trim().max(80).optional().default(""),
  entryMode: z.enum(["create", "join"]),
  next: z.string().optional(),
});

export const signInSchema = z.object({
  locale: localeSchema,
  email: emailSchema,
  password: passwordSchema,
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  locale: localeSchema,
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  locale: localeSchema,
  password: passwordSchema,
});

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAuthActionState: AuthActionState = { status: "idle" };
