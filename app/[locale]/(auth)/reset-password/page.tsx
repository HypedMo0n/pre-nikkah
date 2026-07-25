import { notFound } from "next/navigation";

import { PasswordForm } from "@/components/auth/password-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  return (
    <OnboardingShell locale={locale}>
      <Card className="p-6 shadow-soft sm:p-8">
        <h1 className="font-expressive text-3xl font-medium text-ink">{d["auth.resetTitle"]}</h1>
        <div className="mt-7"><PasswordForm locale={locale} mode="reset" /></div>
      </Card>
    </OnboardingShell>
  );
}
