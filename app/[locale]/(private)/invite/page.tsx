import { notFound } from "next/navigation";
import Link from "next/link";

import { InviteCreator } from "@/components/invites/invite-creator";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function InvitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireAuthenticatedUser(locale);
  const { data: connection } = await supabase.rpc("get_connection_overview");
  const connected = Boolean(
    connection &&
    typeof connection === "object" &&
    "status" in connection &&
    connection.status === "active",
  );
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/dashboard")} locale={locale}>
      <h1 className="font-expressive text-4xl font-medium text-ink">{d["invite.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["invite.body"]}</p>
      {connected ? (
        <Card className="mt-7 border-aligned/40 bg-aligned-soft p-5">
          <p className="font-semibold text-ink">{d["invite.joined"]}</p>
          <Link className={buttonClasses({ className: "mt-4 w-full" })} href={localizedPath(locale, "/dashboard")}>{d["complete.dashboard"]}</Link>
        </Card>
      ) : <InviteCreator locale={locale} />}
    </OnboardingShell>
  );
}
