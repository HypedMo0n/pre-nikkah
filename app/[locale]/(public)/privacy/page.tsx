import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { PrivacySequence } from "@/components/privacy/privacy-sequence";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <OnboardingShell backHref={localizedPath(locale, "/product")} locale={locale}>
      <PrivacySequence locale={locale} />
    </OnboardingShell>
  );
}
