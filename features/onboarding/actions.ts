"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import {
  localeCookieName,
  localizedPath,
  parseLocale,
} from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

import {
  accountDetailsSchema,
  pacePreferenceSchema,
  relationshipStageSchema,
  type OnboardingActionState,
} from "./validation";

export async function setLocaleAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect(localizedPath(locale, "/welcome"));
}

export async function saveAccountDetailsAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = accountDetailsSchema.safeParse({
    locale,
    privateDisplayName: formData.get("privateDisplayName") ?? "",
    entryMode: formData.get("entryMode"),
    inviteCode: formData.get("inviteCode"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: translate(locale, "auth.genericError"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase
    .from("private_accounts")
    .update({
      entry_mode: parsed.data.entryMode,
      onboarding_step: "relationship_stage",
      preferred_locale: locale,
      private_display_name: parsed.data.privateDisplayName || null,
      privacy_intro_completed: true,
      product_intro_completed: true,
    })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }

  const code = parsed.data.inviteCode
    ? `&code=${encodeURIComponent(parsed.data.inviteCode)}`
    : "";
  redirect(
    localizedPath(
      locale,
      `/onboarding/stage?mode=${encodeURIComponent(parsed.data.entryMode)}${code}`,
    ),
  );
}

export async function saveRelationshipStageAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = relationshipStageSchema.safeParse({
    locale,
    entryMode: formData.get("entryMode"),
    inviteCode: formData.get("inviteCode"),
    relationshipStage: formData.get("relationshipStage"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: translate(locale, "auth.genericError"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase
    .from("private_accounts")
    .update({
      onboarding_step: "pace_preference",
      relationship_stage: parsed.data.relationshipStage,
    })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }

  const code = parsed.data.inviteCode
    ? `&code=${encodeURIComponent(parsed.data.inviteCode)}`
    : "";
  redirect(
    localizedPath(
      locale,
      `/onboarding/pace?mode=${parsed.data.entryMode}${code}`,
    ),
  );
}

export async function savePacePreferenceAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = pacePreferenceSchema.safeParse({
    locale,
    entryMode: formData.get("entryMode"),
    inviteCode: formData.get("inviteCode"),
    preferredPace: formData.get("preferredPace"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: translate(locale, "auth.genericError"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase
    .from("private_accounts")
    .update({
      onboarding_step: "journey_policy",
      preferred_pace: parsed.data.preferredPace,
    })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }

  const code = parsed.data.inviteCode
    ? `&code=${encodeURIComponent(parsed.data.inviteCode)}`
    : "";
  redirect(
    localizedPath(
      locale,
      `/onboarding/policy?mode=${parsed.data.entryMode}${code}`,
    ),
  );
}
