import { notFound } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { safeReturnPath } from "@/lib/auth/paths";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ mode?: string; next?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const entryMode = query.mode === "join" ? "join" : "create";
  const next = safeReturnPath(locale, query.next);
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/welcome")} locale={locale}>
      <Card className="p-6 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{d["auth.privateAccount"]}</p>
        <h1 className="font-expressive mt-3 text-3xl font-medium text-ink">{d["auth.signInTitle"]}</h1>
        <p className="mt-3 leading-7 text-body">{d["auth.signInBody"]}</p>
        <div className="mt-7"><AuthForm entryMode={entryMode} locale={locale} mode="sign-in" next={next} /></div>
      </Card>
    </OnboardingShell>
  );
}
