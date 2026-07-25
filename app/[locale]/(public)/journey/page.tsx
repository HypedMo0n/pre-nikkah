import { notFound, redirect } from "next/navigation";

import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function JourneyChoicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(localizedPath(locale, "/welcome"));
}
