import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv, hasPublicEnv } from "@/lib/env/public";
import { isProtectedPath } from "@/lib/auth/paths";
import { parseLocale } from "@/lib/i18n/config";

function copySessionHeaders(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) {
      target.headers.set(header, value);
    }
  }

  return target;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasPublicEnv()) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      const locale = parseLocale(request.nextUrl.pathname.split("/")[1]);
      return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
    }

    return response;
  }

  const env = getPublicEnv();
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headersToSet).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const hasVerifiedIdentity = !error && Boolean(data?.claims?.sub);

  if (!hasVerifiedIdentity && isProtectedPath(request.nextUrl.pathname)) {
    const locale = parseLocale(request.nextUrl.pathname.split("/")[1]);
    const signInUrl = new URL(`/${locale}/sign-in`, request.url);
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    signInUrl.searchParams.set("next", returnTo);

    return copySessionHeaders(response, NextResponse.redirect(signInUrl));
  }

  return response;
}
