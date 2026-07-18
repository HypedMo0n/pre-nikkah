import { notFound } from "next/navigation";

import { InviteCreator } from "@/components/invites/invite-creator";
import { RedeemInviteForm } from "@/components/invites/redeem-invite-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { isInviteCode, normalizeInviteCode } from "@/features/invites/invite-code";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function JourneyPolicyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ code?: string; mode?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const mode = query.mode === "join" ? "join" : "create";
  const inviteCode = normalizeInviteCode(query.code ?? "");
  const backCode = mode === "join" && isInviteCode(inviteCode)
    ? `&code=${encodeURIComponent(inviteCode)}`
    : "";
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={`${localizedPath(locale, "/onboarding/pace")}?mode=${mode}${backCode}`} locale={locale}>
      <h1 className="font-expressive text-4xl font-medium leading-tight text-ink">{d["policy.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["policy.body"]}</p>
      <Card className="mt-7 space-y-4 border-primary/20 bg-primary-soft/55 p-5">
        <p className="font-semibold leading-7 text-ink">{d["policy.disclosure"]}</p>
        <p className="text-sm leading-6 text-body">{d["policy.backups"]}</p>
      </Card>
      {mode === "join" ? (
        isInviteCode(inviteCode) ? <RedeemInviteForm inviteCode={inviteCode} locale={locale} /> : <p className="mt-6 text-sm text-concern" role="alert">{d["join.unavailable"]}</p>
      ) : <InviteCreator locale={locale} />}
    </OnboardingShell>
  );
}
