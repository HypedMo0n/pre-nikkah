import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import { getCurrentTopicId } from "@/features/v3/progress";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  const topic = data.content.topics.find((item) => item.slug === slug);
  if (!topic) notFound();
  const questions = data.content.questions.filter(
    (question) => question.topicId === topic.id,
  );
  const ownIds = new Set(
    data.answers
      .filter((answer) => answer.userId === user.id)
      .map((answer) => answer.questionId),
  );
  const nextQuestion =
    questions.find((question) => !ownIds.has(question.id)) ?? questions[0];
  if (!nextQuestion) notFound();
  const d = getV3Copy(locale);
  const topicProgress = data.progress.find(
    (progress) => progress.topicId === topic.id,
  );
  const comparisons = new Map(
    data.comparisons.map((comparison) => [
      comparison.questionId,
      comparison,
    ]),
  );
  const discussedIds = new Set(
    data.discussions.map((discussion) => discussion.question_id),
  );
  // This page is reachable for any topic, so the partner's count on it is only
  // safe when the topic is the one the couple is currently working through.
  const isCurrentTopic =
    topic.id ===
    getCurrentTopicId(
      data.content.topics,
      data.progress,
      data.content.questions,
      discussedIds,
    );

  return (
    <OnboardingShell
      backHref={localizedPath(locale, "/topics")}
      locale={locale}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {questions.length} {d.topicQuestions}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">
        {topic.title}
      </h1>
      <p className="mt-5 text-lg leading-8 text-muted">{topic.subtitle}</p>

      <div className="mt-7 flex flex-wrap gap-2">
        <Chip tone="aligned">
          {d.yourProgress} · {topicProgress?.own ?? 0} / {questions.length}
        </Chip>
        {isCurrentTopic ? (
          <Chip tone="discuss">
            {data.overview.partner?.displayName ?? d.togetherProgress} ·{" "}
            {topicProgress?.partner ?? 0} / {questions.length}
          </Chip>
        ) : null}
      </div>

      <Card className="mt-5 flex items-start gap-3 border-green/20 bg-green-soft">
        <LockKeyhole
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-green"
          size={19}
        />
        <p className="text-sm leading-6 text-green">{d.topicIntroPrivacy}</p>
      </Card>

      <section aria-label={d.topicQuestions} className="mt-7 space-y-2">
        {questions.map((question, index) => {
          const ownAnswered = ownIds.has(question.id);
          const comparison = comparisons.get(question.id);
          const discussed = discussedIds.has(question.id);
          const ready = comparison && comparison.state !== "pending";
          // Outside the current topic the comparisons policy withholds the row
          // entirely, so its absence means "not visible", not "the partner has
          // not answered". "Answered · waiting" would state the latter, which
          // is a claim about the partner this screen is not entitled to make
          // and which may be false. A fully discussed topic needs no branch of
          // its own: every row there takes the `discussed` label first.
          const label = discussed
            ? d.discussed
            : ready
              ? d.readyToCompare
              : ownAnswered
                ? isCurrentTopic
                  ? d.answeredWaiting
                  : d.answeredCompareLater
                : d.yourTurn;
          const href = ready
            ? localizedPath(locale, `/conversations/${question.id}`)
            : localizedPath(
                locale,
                `/topics/${slug}/questions/${question.id}`,
              );
          return (
            <Link
              className="flex min-h-20 items-center gap-3 rounded-card border border-hairline bg-white p-4 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              href={href}
              key={question.id}
            >
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${
                  discussed
                    ? "bg-green"
                    : ready
                      ? "bg-amber"
                      : ownAnswered
                        ? "bg-green"
                        : "bg-hairline"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-6 text-ink">
                  {index + 1}. {question.text}
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                  {discussed ? (
                    <CheckCircle2 aria-hidden="true" size={13} />
                  ) : null}
                  {label}
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="shrink-0 text-muted"
                size={17}
              />
            </Link>
          );
        })}
      </section>

      {!data.overview.spaceId ? (
        <Link
          className={buttonClasses({ className: "mt-7 w-full" })}
          href={localizedPath(locale, "/invite")}
        >
          {d.createSpace}
        </Link>
      ) : (
        <Link
          className={buttonClasses({ className: "mt-8 w-full" })}
          href={localizedPath(
            locale,
            `/topics/${slug}/questions/${nextQuestion.id}`,
          )}
        >
          {ownIds.size ? d.continueAnswering : d.startTopic}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      )}
    </OnboardingShell>
  );
}
