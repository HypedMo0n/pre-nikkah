import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JoinSpaceForm } from "@/components/v3/join-space-form";
import {
  formatInviteCode,
  isInviteCode,
  normalizeInviteCode,
} from "@/features/invites/invite-code";
import { getV3Copy } from "@/features/v3/copy";
import { getAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ inviteCode: string; locale: string }>;
}) {
  const { inviteCode: rawCode, locale } = await params;
  if (!isLocale(locale)) notFound();
  const code = normalizeInviteCode(rawCode);
  const d = getV3Copy(locale);
  if (!isInviteCode(code)) {
    return (
      <OnboardingShell
        backHref={localizedPath(locale, "/join")}
        locale={locale}
      >
        <p className="text-sm text-danger" role="alert">
          {d.inviteUnavailable}
        </p>
      </OnboardingShell>
    );
  }

  const authenticated = await getAuthenticatedUser();
  if (!authenticated) {
    const next = localizedPath(locale, `/join/${code}`);
    return (
      <OnboardingShell
        backHref={localizedPath(locale, "/join")}
        locale={locale}
      >
        <Card>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
            {d.privacyPromise}
          </p>
          <h1 className="font-expressive mt-3 text-3xl font-medium text-ink">
            {d.joinTitle}
          </h1>
          <p className="mt-5 text-center font-mono text-lg font-semibold tracking-[0.12em] text-green">
            {formatInviteCode(code)}
          </p>
          <div className="mt-7 grid gap-3">
            <Link
              className={buttonClasses({ className: "w-full" })}
              href={`${localizedPath(locale, "/sign-up")}?mode=join&next=${encodeURIComponent(next)}`}
            >
              {d.welcomePrimary}
            </Link>
            <Link
              className={buttonClasses({
                className: "w-full",
                variant: "secondary",
              })}
              href={`${localizedPath(locale, "/sign-in")}?mode=join&next=${encodeURIComponent(next)}`}
            >
              Sign in
            </Link>
          </div>
        </Card>
      </OnboardingShell>
    );
  }

  const { data } = await authenticated.supabase.rpc("inspect_space_invite", {
    p_invite_code: code,
  });
  const available =
    data &&
    typeof data === "object" &&
    "status" in data &&
    data.status === "available";
  return (
    <OnboardingShell
      backHref={localizedPath(locale, "/join")}
      locale={locale}
    >
      <h1 className="font-expressive text-4xl font-medium text-ink">
        {d.joinTitle}
      </h1>
      <p className="mt-4 leading-7 text-muted">
        {available ? d.joinBody : d.inviteUnavailable}
      </p>
      {available ? (
        <JoinSpaceForm initialCode={code} locale={locale} />
      ) : (
        <Link
          className={buttonClasses({ className: "mt-7 w-full", variant: "secondary" })}
          href={localizedPath(locale, "/join")}
        >
          {d.back}
        </Link>
      )}
    </OnboardingShell>
  );
}
