import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";

const protectedPrefixes = [
  "/dashboard",
  "/onboarding",
  "/invite",
  "/topics",
  "/comparisons",
  "/conversations",
  "/checklist",
  "/summary",
  "/settings",
  "/test-complete",
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
  fallback = localizedPath(locale, "/dashboard"),
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
