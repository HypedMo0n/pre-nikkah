import "server-only";

import { redirect } from "next/navigation";

import { hasPublicEnv } from "@/lib/env/public";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  if (!hasPublicEnv()) {
    return null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function requireAuthenticatedUser(locale: Locale, returnTo?: string) {
  const authenticated = await getAuthenticatedUser();
  if (!authenticated) {
    const signIn = new URL(
      localizedPath(locale, "/sign-in"),
      "http://internal.local",
    );
    if (returnTo) {
      signIn.searchParams.set("next", returnTo);
    }
    redirect(`${signIn.pathname}${signIn.search}`);
  }
  return authenticated;
}
