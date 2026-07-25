import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function AccountDeletedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  return (
    <OnboardingShell locale={locale}>
      <div className="text-center">
        <h1 className="font-expressive text-4xl font-medium text-ink">{d["settings.deletedTitle"]}</h1>
        <p className="mt-4 leading-7 text-body">{d["settings.deletedBody"]}</p>
        <Link className={buttonClasses({ className: "mt-8 w-full" })} href={localizedPath(locale, "/welcome")}>{d["common.home"]}</Link>
      </div>
    </OnboardingShell>
  );
}
