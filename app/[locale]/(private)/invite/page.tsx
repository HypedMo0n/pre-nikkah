import { Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InvitePanel } from "@/components/v3/invite-panel";
import { getV3Copy } from "@/features/v3/copy";
import { getSpaceOverview } from "@/features/v3/data";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireAuthenticatedUser(locale);
  const overview = await getSpaceOverview(supabase);
  const d = getV3Copy(locale);

  return (
    <OnboardingShell
      backHref={localizedPath(locale, "/dashboard")}
      locale={locale}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.privacyPromise}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium text-ink">
        {d.inviteTitle}
      </h1>
      <p className="mt-4 leading-7 text-muted">{d.inviteBody}</p>

      {overview.status === "active" || overview.status === "paused" ? (
        <Card className="mt-7 border-green/20 bg-green-soft text-center">
          <Users aria-hidden="true" className="mx-auto text-green" size={24} />
          <p className="mt-3 font-semibold text-ink">{d.connected}</p>
          <p className="mt-1 text-sm text-muted">
            {overview.partner?.displayName}
          </p>
          <Link
            className={buttonClasses({ className: "mt-5 w-full" })}
            href={localizedPath(locale, "/dashboard")}
          >
            {d.home}
          </Link>
        </Card>
      ) : (
        <InvitePanel locale={locale} />
      )}
    </OnboardingShell>
  );
}
