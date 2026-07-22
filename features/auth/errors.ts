import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

export function getSafeAuthError(locale: Locale, message?: string, code?: string) {
  // Supabase Auth's structured error code is checked first — it is
  // reliable where present, unlike matching on message text. This is
  // Supabase's built-in per-project outbound email limit, not an
  // application fault; retrying immediately will not help.
  if (code === "over_email_send_rate_limit") {
    return translate(locale, "auth.emailRateLimited");
  }
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
  if (normalized.includes("email rate limit exceeded")) {
    return translate(locale, "auth.emailRateLimited");
  }
  return translate(locale, "auth.genericError");
}
