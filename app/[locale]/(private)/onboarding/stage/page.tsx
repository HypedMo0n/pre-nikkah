import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { StageForm } from "@/components/onboarding/stage-form";
import { normalizeInviteCode } from "@/features/invites/invite-code";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function RelationshipStagePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ code?: string; mode?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const entryMode = query.mode === "join" ? "join" : "create";
  const inviteCode = entryMode === "join" && query.code ? normalizeInviteCode(query.code) : undefined;
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={`${localizedPath(locale, "/onboarding/account")}?mode=${entryMode}${inviteCode ? `&code=${encodeURIComponent(inviteCode)}` : ""}`} locale={locale}>
      <h1 className="font-expressive text-4xl font-medium leading-tight text-ink">{d["stage.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["stage.body"]}</p>
      <StageForm entryMode={entryMode} inviteCode={inviteCode} locale={locale} />
    </OnboardingShell>
  );
}
