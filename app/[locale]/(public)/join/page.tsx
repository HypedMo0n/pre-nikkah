import { notFound } from "next/navigation";

import { JoinCodeForm } from "@/components/invites/join-code-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function JoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/journey")} locale={locale}>
      <h1 className="font-expressive text-4xl font-medium text-ink">{d["join.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["join.body"]}</p>
      <JoinCodeForm locale={locale} />
    </OnboardingShell>
  );
}
