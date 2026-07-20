import { NextRequest, NextResponse } from "next/server";

import {
  isInviteCode,
  normalizeInviteCode,
} from "@/features/invites/invite-code";
import { inviteIntentCookieName } from "@/lib/auth/invite-intent";
import { isLocale } from "@/lib/i18n/config";

const maxAgeSeconds = 60 * 60 * 24 * 7;

function isSafeDestination(
  destination: string,
  locale: "en" | "fr",
) {
  if (!destination.startsWith(`/${locale}/`)) {
    return false;
  }

  if (destination.startsWith("//")) {
    return false;
  }

  try {
    const parsed = new URL(
      destination,
      "https://example.invalid",
    );

    return (
      parsed.origin === "https://example.invalid" &&
      parsed.pathname.startsWith(`/${locale}/`)
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const code = normalizeInviteCode(
    request.nextUrl.searchParams.get("code") ?? "",
  );

  const locale =
    request.nextUrl.searchParams.get("locale") ?? "";

  const destination =
    request.nextUrl.searchParams.get("destination") ?? "";

  if (
    !isLocale(locale) ||
    !isInviteCode(code) ||
    !isSafeDestination(destination, locale)
  ) {
    return NextResponse.redirect(
      new URL("/en/join", request.url),
    );
  }

  const response = NextResponse.redirect(
    new URL(destination, request.url),
  );

  response.cookies.set(inviteIntentCookieName, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return response;
}