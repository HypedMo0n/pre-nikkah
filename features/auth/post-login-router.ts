"use server";

import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Router for authenticated users based on their journey state.
 *
 * Routes:
 * 1. If valid invite code provided and available -> redirect to invite inspection
 * 2. If active couple exists -> redirect to dashboard
 * 3. If waiting journey exists -> redirect to waiting-journey page (resume/cancel/join-other)
 * 4. If onboarding complete but no journey -> redirect to dashboard
 * 5. Otherwise -> redirect to onboarding start (choose create or join)
 */
export async function getPostLoginRoute(
  locale: Locale,
  inviteCode?: string,
): Promise<string> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return localizedPath(locale, "/");
  }

  // If invite code is provided, inspect it first
  if (inviteCode) {
    const { data: inspection } = await supabase.rpc(
      "inspect_couple_invite",
      {
        p_invite_code: inviteCode,
      },
    );

    if (inspection?.status === "available") {
      return localizedPath(locale, `/invite/${inviteCode}`);
    }
  }

  // Check for active couple (both members, status='active')
  const { data: activeCouple } = await supabase.rpc("current_couple_id");
  if (activeCouple) {
    return localizedPath(locale, "/dashboard");
  }

  // Check for waiting couple (user_a only, status='waiting', no user_b)
  const { data: waitingCouple } = await supabase.rpc("waiting_couple_id_for", {
    p_user_id: user.id,
  });
  if (waitingCouple) {
    return localizedPath(locale, "/onboarding/waiting-journey");
  }

  // Check if onboarding is complete
  const { data: account } = await supabase
    .from("private_accounts")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (account?.onboarding_completed) {
    return localizedPath(locale, "/dashboard");
  }

  // Start onboarding
  return localizedPath(locale, "/onboarding/start");
}
