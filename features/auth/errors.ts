import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

export function getSafeAuthError(locale: Locale, message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("email not confirmed")) {
    return translate(locale, "auth.emailNotVerified");
  }
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return translate(locale, "auth.invalidCredentials");
  }
  return translate(locale, "auth.genericError");
}
