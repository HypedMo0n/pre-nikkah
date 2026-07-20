import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { abandonEmptyWaitingJourneyFormAction } from "@/features/invites/journey-actions";
import { getInviteIntent } from "@/lib/auth/invite-intent";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function WaitingJourneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  const intent = await getInviteIntent();
  return (
    <OnboardingShell backHref={localizedPath(locale, "/dashboard")} locale={locale}>
      <Card className="p-6 shadow-soft">
        <h1 className="font-expressive text-3xl font-medium text-ink">{d["waitingJourney.title"]}</h1>
        <p className="mt-3 leading-7 text-body">{d["waitingJourney.body"]}</p>
        <div className="mt-7 grid gap-3">
          <Link className="inline-flex min-h-12 items-center justify-center rounded-productive border border-primary/30 px-5 text-center font-semibold text-primary" href={localizedPath(locale, "/dashboard")}>{d["waitingJourney.keep"]}</Link>
          <form action={abandonEmptyWaitingJourneyFormAction}>
            <input name="locale" type="hidden" value={locale} />
            <SubmitButton className="w-full" pendingLabel={d["common.continue"]}>{d["waitingJourney.close"]}</SubmitButton>
          </form>
          {intent ? (
            <form action={abandonEmptyWaitingJourneyFormAction}>
              <input name="locale" type="hidden" value={locale} />
              <input name="continueToInvite" type="hidden" value="1" />
              <SubmitButton className="w-full" pendingLabel={d["common.continue"]}>{d["waitingJourney.closeAndJoin"]}</SubmitButton>
            </form>
          ) : null}
        </div>
      </Card>
    </OnboardingShell>
  );
}
