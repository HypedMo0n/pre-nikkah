import { notFound } from "next/navigation";

import { AccountDetailsForm } from "@/components/onboarding/account-details-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { normalizeInviteCode } from "@/features/invites/invite-code";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function AccountOnboardingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ code?: string; mode?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const entryMode = query.mode === "join" ? "join" : "create";
  const inviteCode = entryMode === "join" && query.code ? normalizeInviteCode(query.code) : undefined;
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/journey")} locale={locale}>
      <Card className="p-6 shadow-soft sm:p-8">
        <h1 className="font-expressive text-3xl font-medium text-ink">{d["account.title"]}</h1>
        <p className="mt-3 leading-7 text-body">{d["account.body"]}</p>
        <AccountDetailsForm entryMode={entryMode} inviteCode={inviteCode} locale={locale} />
      </Card>
    </OnboardingShell>
  );
}
