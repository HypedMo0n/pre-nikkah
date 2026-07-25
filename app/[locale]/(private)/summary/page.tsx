import { Download, MessageCircle, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  const d = getV3Copy(locale);
  const ownAnswers = data.answers.filter(
    (answer) => answer.userId === user.id,
  ).length;
  const ready = data.comparisons.filter(
    (comparison) => comparison.state !== "pending",
  ).length;

  return (
    <OnboardingShell
      backHref={localizedPath(locale, "/settings")}
      locale={locale}
      productive
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.privacyPromise}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium text-ink">
        {d.summaryTitle}
      </h1>
      <p className="mt-4 leading-7 text-muted">{d.summaryBody}</p>

      <div className="mt-8 grid grid-cols-3 gap-2">
        <Metric label={d.topicsProgress} value={data.content.topics.length} />
        <Metric label={d.yourProgress} value={ownAnswers} />
        <Metric label={d.discuss} value={ready} />
      </div>

      <Card className="mt-6 flex items-start gap-3 border-green/20 bg-green-soft">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-green"
          size={19}
        />
        <p className="text-sm leading-6 text-green">{d.summaryNotice}</p>
      </Card>

      <section className="mt-9" aria-labelledby="summary-notes">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink" id="summary-notes">
          <MessageCircle aria-hidden="true" size={20} />
          {d.topicRecord}
        </h2>
        <div className="mt-4 space-y-3">
          {data.content.topics.map((topic) => {
            const questionIds = new Set(
              data.content.questions
                .filter((question) => question.topicId === topic.id)
                .map((question) => question.id),
            );
            const comparisons = data.comparisons.filter(
              (comparison) =>
                questionIds.has(comparison.questionId) &&
                comparison.state !== "pending",
            );
            const discussions = data.discussions
              .filter((discussion) =>
                questionIds.has(discussion.question_id),
              )
              .sort(
                (left, right) =>
                  new Date(right.discussed_at).getTime() -
                  new Date(left.discussed_at).getTime(),
              );
            const notes = data.sharedNotes.filter((note) =>
              questionIds.has(note.question_id),
            );
            return (
              <Card key={topic.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-ink">{topic.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {discussions[0]
                        ? `${d.discussedOn} ${new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                          }).format(new Date(discussions[0].discussed_at))}`
                        : d.notDiscussedYet}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted">
                    {comparisons.filter(
                      (comparison) => comparison.state === "aligned",
                    ).length}{" "}
                    {d.alignmentPatterns}
                    {" · "}
                    {comparisons.filter(
                      (comparison) => comparison.state === "discuss",
                    ).length}{" "}
                    {d.conversationPatterns}
                  </span>
                </div>
                {notes.length ? (
                  <div className="mt-4 space-y-3 border-t border-hairline pt-4">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
                      {d.sharedNotes}
                    </p>
                    {notes.map((note) => (
                      <p
                        className="border-s-2 border-green ps-3 text-sm leading-6 text-ink"
                        key={note.id}
                      >
                        {note.body}
                      </p>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <a
        className={buttonClasses({ className: "mt-8 w-full" })}
        download
        href={localizedPath(locale, "/summary/export")}
      >
        <Download aria-hidden="true" size={18} />
        {d.export}
      </a>
    </OnboardingShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-hairline bg-white px-2 py-4 text-center">
      <p className="font-expressive text-3xl font-medium text-green">{value}</p>
      <p className="mt-1 text-[0.6875rem] font-semibold text-muted">{label}</p>
    </div>
  );
}
