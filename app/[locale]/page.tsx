import { notFound, redirect } from "next/navigation";

import { isLocale, localizedPath } from "@/lib/i18n/config";

type LocaleIndexPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function LocaleIndexPage({ params }: LocaleIndexPageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  redirect(localizedPath(locale, "/welcome"));
}
