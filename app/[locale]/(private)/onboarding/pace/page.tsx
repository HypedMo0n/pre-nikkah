import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { PaceForm } from "@/components/onboarding/pace-form";
import { normalizeInviteCode } from "@/features/invites/invite-code";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function PacePreferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string; mode?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const entryMode = query.mode === "join" ? "join" : "create";
  const inviteCode =
    entryMode === "join" && query.code
      ? normalizeInviteCode(query.code)
      : undefined;
  const d = getDictionary(locale);

  return (
    <OnboardingShell
      backHref={`${localizedPath(locale, "/onboarding/stage")}?mode=${entryMode}${inviteCode ? `&code=${encodeURIComponent(inviteCode)}` : ""}`}
      locale={locale}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {d["pace.eyebrow"]}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">
        {d["pace.title"]}
      </h1>
      <p className="mt-4 leading-7 text-body">{d["pace.body"]}</p>
      <PaceForm entryMode={entryMode} inviteCode={inviteCode} locale={locale} />
    </OnboardingShell>
  );
}
