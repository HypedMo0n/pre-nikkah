import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasPublicEnv, getPublicEnv } from "@/lib/env/public";

const protectedPrefixes = [
  "/dashboard",
  "/topics",
  "/comparisons",
  "/conversations",
  "/checklist",
  "/summary",
  "/settings",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasPublicEnv()) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return response;
  }

  const env = getPublicEnv();
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const signInUrl = new URL("/sign-in", request.url);
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    signInUrl.searchParams.set("next", returnTo);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}
