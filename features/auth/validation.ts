import { z } from "zod";

import { locales } from "@/lib/i18n/config";

const localeSchema = z.enum(locales);
const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(8).max(128);

// entryMode decides where signUpAction sends the user next (create a space
// vs. redeem a pending invite) — it is never persisted. v3's profiles table
// has no equivalent of the pre-v3 durable entry_mode field.
export const signUpSchema = z.object({
  locale: localeSchema,
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
  entryMode: z.enum(["create", "join"]),
  // .nullish() rather than .optional(): FormData.get() returns null (not
  // undefined) for a field with no matching input, which AccountForm and
  // SignInForm only render when a `next` prop is actually passed in.
  // .optional() alone rejects that null and fails the whole parse.
  next: z.string().nullish(),
});

export const signInSchema = z.object({
  locale: localeSchema,
  email: emailSchema,
  password: passwordSchema,
  next: z.string().nullish(),
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
