import { notFound } from "next/navigation";

import { LocaleDocument } from "@/components/i18n/locale-document";
import { isLocale, locales } from "@/lib/i18n/config";

// Derived from `locales` rather than hardcoded, so adding a third
// language needs no change here — see task #17's locale-scaling audit.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <>
      <LocaleDocument locale={locale} />
      {children}
    </>
  );
}
