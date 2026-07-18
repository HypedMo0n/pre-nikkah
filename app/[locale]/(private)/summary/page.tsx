import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function SummaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  return <OnboardingShell backHref={localizedPath(locale, "/settings")} locale={locale} productive><h1 className="text-3xl font-semibold text-ink">{d["summary.title"]}</h1><Card className="mt-6 p-5"><p className="text-sm leading-6 text-body">{d["summary.body"]}</p><p className="mt-4 text-xs font-semibold text-ink-soft">Discussion summary. Not religious, psychological, or legal advice.</p></Card><a className={buttonClasses({ className: "mt-6 w-full" })} download href={localizedPath(locale, "/summary/export")}>{d["settings.export"]}</a></OnboardingShell>;
}
