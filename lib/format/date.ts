import type { Locale } from "@/lib/i18n/config";

export function formatDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(isoDate));
}
