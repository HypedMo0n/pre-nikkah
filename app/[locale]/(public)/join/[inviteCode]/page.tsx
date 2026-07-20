import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { formatInviteCode, isInviteCode, normalizeInviteCode } from "@/features/invites/invite-code";
import { inspectInvite } from "@/features/invites/server";
import { setInviteIntent } from "@/lib/auth/invite-intent";
import { getAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function InspectInvitePage({ params }: { params: Promise<{ inviteCode: string; locale: string }> }) {
  const { inviteCode: rawCode, locale } = await params;
  if (!isLocale(locale)) notFound();
  const code = normalizeInviteCode(rawCode);
  const d = getDictionary(locale);
  const authenticated = await getAuthenticatedUser();
  const next = `${localizedPath(locale, "/onboarding/account")}?mode=join&code=${encodeURIComponent(code)}`;

  if (!isInviteCode(code)) {
    return <OnboardingShell backHref={localizedPath(locale, "/join")} locale={locale}><p className="text-sm text-concern" role="alert">{d["join.unavailable"]}</p></OnboardingShell>;
  }
  if (!authenticated) {
    await setInviteIntent(code);
    return (
      <OnboardingShell backHref={localizedPath(locale, "/join")} locale={locale}>
        <Card className="p-6 shadow-soft">
          <h1 className="font-expressive text-3xl font-medium text-ink">{d["join.availableTitle"]}</h1>
          <p className="mt-3 leading-7 text-body">{d["auth.createBody"]}</p>
          <p className="mt-5 text-center font-mono text-lg font-semibold tracking-widest text-primary">{formatInviteCode(code)}</p>
          <div className="mt-7 grid gap-3">
            <Link className={buttonClasses()} href={`${localizedPath(locale, "/sign-up")}?mode=join&next=${encodeURIComponent(next)}`}>{d["auth.createAction"]}</Link>
            <Link className={buttonClasses({ variant: "secondary" })} href={`${localizedPath(locale, "/sign-in")}?mode=join&next=${encodeURIComponent(next)}`}>{d["common.signIn"]}</Link>
          </div>
        </Card>
      </OnboardingShell>
    );
  }

  const inspection = await inspectInvite(locale, code);
  const message = inspection.status === "self_invite" ? d["join.self"] : inspection.status === "active_couple_conflict" ? d["join.conflict"] : d["join.unavailable"];
  if (inspection.status !== "available") {
    return <OnboardingShell backHref={localizedPath(locale, "/join")} locale={locale}><p className="text-sm text-concern" role="alert">{message}</p></OnboardingShell>;
  }
  return (
    <OnboardingShell backHref={localizedPath(locale, "/join")} locale={locale}>
      <Card className="p-6 shadow-soft">
        <h1 className="font-expressive text-3xl font-medium text-ink">{d["join.availableTitle"]}</h1>
        <p className="mt-3 leading-7 text-body">{d["join.availableBody"]}</p>
        <p className="mt-4 text-sm text-ink-soft">{d["invite.expires"]} {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(inspection.expiresAt))}.</p>
        <Link className={buttonClasses({ className: "mt-7 w-full" })} href={next}>{d["common.continue"]}</Link>
      </Card>
    </OnboardingShell>
  );
}
