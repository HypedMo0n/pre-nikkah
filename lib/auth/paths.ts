import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";

// /create-space is deliberately not here — it is the pre-auth sign-up
// screen (account creation happens on it), not a destination that requires
// being signed in already. Space creation itself happens on /invite, which
// is protected.
const protectedPrefixes = [
  "/home",
  "/invite",
  "/topics",
  "/record",
  "/settings",
];

export function removeLocalePrefix(pathname: string) {
  return pathname.replace(/^\/(?:en|fr)(?=\/|$)/, "") || "/";
}

export function isProtectedPath(pathname: string) {
  const path = removeLocalePrefix(pathname);
  return protectedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function safeReturnPath(
  locale: Locale,
  value: FormDataEntryValue | string | null | undefined,
  fallback = localizedPath(locale, "/home"),
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const expectedPrefix = `/${locale}/`;
  if (
    !value.startsWith(expectedPrefix) ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\r\n]/.test(value)
  ) {
    return fallback;
  }

  return value;
}
