import {
  Mail,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  CloseSpaceForm,
  ProfileForm,
} from "@/components/v3/settings-forms";
import { SettingsLanguageSheet } from "@/components/v3/settings-language-sheet";
import { signOutAction } from "@/features/auth/actions";
import { setPausedAction } from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import { getSpaceOverview } from "@/features/v3/data";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [profileResult, overview] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,locale")
      .eq("id", user.id)
      .single(),
    getSpaceOverview(supabase),
  ]);
  const d = getV3Copy(locale);

  return (
    <OnboardingShell locale={locale} productive withTabBar>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.settings}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium text-ink">
        {d.profile}
      </h1>

      <p className="mt-7 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted">
        {d.account}
      </p>
      <Card className="mt-3">
        <p className="flex items-center gap-2 border-b border-hairline pb-4 text-sm text-muted">
          <Mail aria-hidden="true" size={16} />
          {user.email}
        </p>
        <ProfileForm
          displayName={profileResult.data?.display_name ?? d.member}
          locale={locale}
        />
      </Card>

      <section aria-labelledby="preferences-controls" className="mt-9">
        <h2
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted"
          id="preferences-controls"
        >
          {d.preferences}
        </h2>
        <div className="mt-3">
          <SettingsLanguageSheet d={d} locale={locale} />
        </div>
      </section>

      {overview.partner ? (
        <section aria-labelledby="space-controls" className="mt-9">
          <h2
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted"
            id="space-controls"
          >
            {d.yourSpace}
          </h2>
          <Card className="mt-3">
            <p className="flex items-center gap-3 text-sm text-muted">
              <Users aria-hidden="true" className="text-green" size={18} />
              {d.pairedWith}
              <strong className="text-ink">
                {overview.partner.displayName}
              </strong>
            </p>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="data-controls" className="mt-9">
        <h2
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted"
          id="data-controls"
        >
          {d.privacyAndData}
        </h2>
        <div className="mt-3 grid gap-3">
          <Card className="border-green/20 bg-green-soft">
            <p className="flex items-center gap-2 font-semibold text-green">
              <ShieldCheck aria-hidden="true" size={18} />
              {d.partnerVisibility}
            </p>
            <p className="mt-3 text-sm leading-6 text-ink">
              {d.partnerVisibilityBody}
            </p>
          </Card>
          <Link
            className={buttonClasses({ className: "w-full", variant: "secondary" })}
            href={localizedPath(locale, "/summary")}
          >
            {d.export}
          </Link>
          {/* Persistent off-ramp: always present, never conditional on any answer. */}
          <Link
            className={buttonClasses({ className: "w-full", variant: "secondary" })}
            href={localizedPath(locale, "/resources")}
          >
            {d.safetyLink}
          </Link>
          {overview.status === "active" || overview.status === "paused" ? (
            <form action={setPausedAction}>
              <input name="locale" type="hidden" value={locale} />
              <input
                name="paused"
                type="hidden"
                value={overview.status === "active" ? "true" : "false"}
              />
              <SubmitButton
                className="w-full"
                pendingLabel={d.saving}
                variant="secondary"
              >
                {overview.status === "active" ? (
                  <PauseCircle aria-hidden="true" size={18} />
                ) : (
                  <PlayCircle aria-hidden="true" size={18} />
                )}
                {overview.status === "active" ? d.pause : d.resume}
              </SubmitButton>
            </form>
          ) : null}
          <form action={signOutAction}>
            <input name="locale" type="hidden" value={locale} />
            <button
              className={buttonClasses({ className: "w-full", variant: "ghost" })}
              type="submit"
            >
              {d.signOut}
            </button>
          </form>
        </div>
      </section>

      {overview.spaceId ? (
        <Card className="mt-10 border-danger/30 bg-white">
          <h2 className="text-xl font-semibold text-danger">{d.unlinkPartner}</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{d.closeBody}</p>
          <CloseSpaceForm locale={locale} />
        </Card>
      ) : null}

      <Card className="mt-4 border-danger/30 bg-white">
        <h2 className="text-xl font-semibold text-danger">{d.deleteAccount}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{d.deleteBody}</p>
        <DeleteAccountForm locale={locale} />
      </Card>
    </OnboardingShell>
  );
}
