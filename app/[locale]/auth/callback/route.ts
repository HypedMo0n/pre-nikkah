import { NextResponse, type NextRequest } from "next/server";

import { getPostLoginRoute } from "@/features/auth/post-login-router";
import { safeReturnPath } from "@/lib/auth/paths";
import { hasPublicEnv } from "@/lib/env/public";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ locale: string }> }) {
  const { locale } = await context.params;
  if (!isLocale(locale)) return NextResponse.redirect(new URL("/", request.url));
  const code = request.nextUrl.searchParams.get("code");
  const next = safeReturnPath(locale, request.nextUrl.searchParams.get("next"));
  if (!hasPublicEnv() || !code) {
    return NextResponse.redirect(new URL(localizedPath(locale, "/sign-in"), request.url));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const route = error ? localizedPath(locale, "/sign-in") : await getPostLoginRoute(locale, supabase, next);
  return NextResponse.redirect(new URL(route, request.url));
}
