import { MailCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function VerifyEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  return (
    <OnboardingShell locale={locale}>
      <Card className="p-7 text-center shadow-soft sm:p-9">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><MailCheck aria-hidden="true" size={25} /></span>
        <h1 className="font-expressive mt-6 text-3xl font-medium text-ink">{d["auth.verifyTitle"]}</h1>
        <p className="mt-3 leading-7 text-body">{d["auth.verifyBody"]}</p>
        <Link className={buttonClasses({ className: "mt-7 w-full" })} href={localizedPath(locale, "/sign-in")}>{d["common.signIn"]}</Link>
      </Card>
    </OnboardingShell>
  );
}
