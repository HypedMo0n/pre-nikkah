"use server";

import { redirect } from "next/navigation";

import { getAuthRedirectOrigin } from "@/lib/auth/origin";
import { safeReturnPath } from "@/lib/auth/paths";
import { hasPublicEnv } from "@/lib/env/public";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";

import { getSafeAuthError } from "./errors";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type AuthActionState,
} from "./validation";

function unavailable(locale: Locale): AuthActionState {
  return { status: "error", message: translate(locale, "auth.unavailable") };
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = signUpSchema.safeParse({
    locale,
    email: formData.get("email"),
    password: formData.get("password"),
    privateDisplayName: formData.get("privateDisplayName"),
    entryMode: formData.get("entryMode"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: translate(locale, "auth.genericError"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (!hasPublicEnv()) {
    return unavailable(locale);
  }

  const next = safeReturnPath(
    locale,
    parsed.data.next,
    localizedPath(locale, `/onboarding/account?mode=${parsed.data.entryMode}`),
  );
  const origin = getAuthRedirectOrigin();
  const emailRedirectTo = origin
    ? `${origin}${localizedPath(locale, "/auth/callback")}?next=${encodeURIComponent(next)}`
    : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        entry_mode: parsed.data.entryMode,
        preferred_locale: locale,
        private_display_name: parsed.data.privateDisplayName || null,
      },
      emailRedirectTo,
    },
  });

  if (error) {
    return { status: "error", message: getSafeAuthError(locale, error.message) };
  }
  if (!data.session) {
    redirect(localizedPath(locale, "/verify-email"));
  }
  redirect(next);
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = signInSchema.safeParse({
    locale,
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: translate(locale, "auth.invalidCredentials"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (!hasPublicEnv()) {
    return unavailable(locale);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { status: "error", message: getSafeAuthError(locale, error.message) };
  }

  redirect(safeReturnPath(locale, parsed.data.next));
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = forgotPasswordSchema.safeParse({
    locale,
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }
  if (!hasPublicEnv()) {
    return unavailable(locale);
  }

  const origin = getAuthRedirectOrigin();
  const redirectTo = origin
    ? `${origin}${localizedPath(locale, "/auth/callback")}?next=${encodeURIComponent(
        localizedPath(locale, "/reset-password"),
      )}`
    : undefined;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  // The same response is returned for unknown and known emails.
  return { status: "success", message: translate(locale, "auth.resetSent") };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = resetPasswordSchema.safeParse({
    locale,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }
  if (!hasPublicEnv()) {
    return unavailable(locale);
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: getSafeAuthError(locale, error.message) };
  }
  redirect(localizedPath(locale, "/dashboard"));
}

export async function signOutAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  if (hasPublicEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect(localizedPath(locale, "/sign-in"));
}
