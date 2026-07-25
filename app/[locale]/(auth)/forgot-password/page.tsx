import { notFound } from "next/navigation";

import { PasswordForm } from "@/components/auth/password-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/sign-in")} locale={locale}>
      <Card className="p-6 shadow-soft sm:p-8">
        <h1 className="font-expressive text-3xl font-medium text-ink">{d["auth.forgotTitle"]}</h1>
        <p className="mt-3 leading-7 text-body">{d["auth.forgotBody"]}</p>
        <div className="mt-7"><PasswordForm locale={locale} mode="forgot" /></div>
      </Card>
    </OnboardingShell>
  );
}
