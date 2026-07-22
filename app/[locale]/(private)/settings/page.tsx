import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CloseJourneyForm,
  DisplayNameSettingsForm,
} from "@/components/settings/account-settings-forms";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { setOwnAnswerRevealAction } from "@/features/answers/actions";
import { signOutAction } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isTesterEnvironment } from "@/lib/env/public";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [accountResult, revealedResult, coupleResult, connectionResult] = await Promise.all([
    supabase
      .from("private_accounts")
      .select("private_display_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("answers")
      .select("question_id")
      .eq("user_id", user.id)
      .eq("revealed", true),
    supabase.rpc("current_couple_id"),
    supabase.rpc("get_connection_overview"),
  ]);
  const revealedIds = (revealedResult.data ?? []).map((answer) => answer.question_id);
  const revealedQuestions = revealedIds.length
    ? (
        await supabase
          .from("questions")
          .select("id,text")
          .in("id", revealedIds)
          .order("order_index")
      ).data ?? []
    : [];
  const connectionStatus = connectionResult.data && typeof connectionResult.data === "object" && "status" in connectionResult.data
    ? connectionResult.data.status
    : "not_connected";
  const d = getDictionary(locale);
  const testerEnvironment = isTesterEnvironment();

  return (
    <OnboardingShell
      locale={locale}
      productive
      withTabBar
    >
      <h1 className="font-expressive text-3xl font-medium text-ink">{d["settings.title"]}</h1>

      <h2 className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">{d["settings.accountSection"]}</h2>

      <Card className="mt-6 p-5">
        <h2 className="text-xl font-semibold text-ink">{d["settings.displayNameTitle"]}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{d["auth.displayNameHint"]}</p>
        <DisplayNameSettingsForm
          initialValue={accountResult.data?.private_display_name ?? ""}
          locale={locale}
        />
      </Card>

      <div className="mt-6 grid gap-3">
        <div className="grid grid-cols-2 gap-3" aria-label={d["settings.language"]}>
          <Link aria-current={locale === "en" ? "page" : undefined} className={buttonClasses({ variant: locale === "en" ? "primary" : "secondary", className: "w-full" })} href="/en/settings">English</Link>
          <Link aria-current={locale === "fr" ? "page" : undefined} className={buttonClasses({ variant: locale === "fr" ? "primary" : "secondary", className: "w-full" })} href="/fr/settings">Français</Link>
        </div>
        <Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/forgot-password")}>{d["auth.forgotTitle"]}</Link>
        <form action={signOutAction}><input name="locale" type="hidden" value={locale} /><button className={buttonClasses({ variant: "ghost", className: "w-full" })} type="submit">{d["common.signOut"]}</button></form>
      </div>

      <h2 className="mt-9 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">{d["settings.privacySection"]}</h2>
      <Card className="mt-8 p-5">
        <h2 className="text-xl font-semibold text-ink">{d["settings.revealedTitle"]}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{d["settings.revealedBody"]}</p>
        {revealedQuestions.length ? (
          <div className="mt-4 space-y-3">
            {revealedQuestions.map((question) => (
              <div className="rounded-productive border bg-background p-4" key={question.id}>
                <p className="text-sm font-semibold leading-6 text-ink">{question.text}</p>
                <form action={setOwnAnswerRevealAction} className="mt-3">
                  <input name="locale" type="hidden" value={locale} />
                  <input name="questionId" type="hidden" value={question.id} />
                  <input name="revealed" type="hidden" value="false" />
                  <SubmitButton pendingLabel={d["common.loading"]} variant="secondary">
                    {d["conversation.stop"]}
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">{d["settings.revealedEmpty"]}</p>
        )}
      </Card>

      <div className="mt-4 grid gap-3">
        <Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/summary")}>{d["settings.export"]}</Link>
        <Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/privacy")}>{d["privacy.title"]}</Link>
      </div>

      {testerEnvironment ? <section className="mt-9" aria-labelledby="beta-testing-heading"><h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft" id="beta-testing-heading">{d["settings.betaSection"]}</h2><Card className="mt-3 p-5"><p className="text-sm leading-6 text-body">{d["demo.warningBody"]}</p><Link className={buttonClasses({ variant: "secondary", className: "mt-4 w-full" })} href={localizedPath(locale, "/test-complete")}>{d["settings.controlledTest"]}</Link></Card></section> : null}

      <div className="mt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-concern">{d["settings.dangerZone"]}</p>
        {coupleResult.data ? (
          <Card className="mt-3 border-concern/30 bg-concern-soft p-5">
            <h2 className="text-xl font-semibold text-concern">{d["settings.closeTitle"]}</h2>
            <p className="mt-3 text-sm leading-6 text-body">{d["settings.closeBody"]}</p>
            <CloseJourneyForm locale={locale} mode={connectionStatus === "waiting" ? "waiting" : "active"} />
          </Card>
        ) : null}


        <Card className="mt-4 border-concern/30 bg-concern-soft p-5">
          <h2 className="text-xl font-semibold text-concern">{d["settings.deleteTitle"]}</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-ink">{d["settings.deleteBody"]}</p>
          <p className="mt-3 text-xs leading-5 text-ink-soft">{d["settings.deleteBackup"]}</p>
          <DeleteAccountForm locale={locale} />
        </Card>
      </div>
    </OnboardingShell>
  );
}
