import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function ComparisonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  const d = getV3Copy(locale);
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const questionRank = new Map(
    data.content.questions.map((question, index) => [question.id, index]),
  );
  const ready = data.comparisons
    .filter((comparison) => comparison.state !== "pending")
    .sort(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        (questionRank.get(left.questionId) ?? 0) -
          (questionRank.get(right.questionId) ?? 0),
    );
  const discussedIds = new Set(
    data.discussions.map((discussion) => discussion.question_id),
  );
  const alignedCount = ready.filter(
    (comparison) => comparison.state === "aligned",
  ).length;
  const discussCount = ready.filter(
    (comparison) => comparison.state === "discuss",
  ).length;
  const partnerPriorityCount = data.overview.partner
    ? ready.filter((comparison) =>
        comparison.highPriorityUserIds.includes(data.overview.partner!.id),
      ).length
    : 0;

  return (
    <OnboardingShell locale={locale} productive withTabBar>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.discuss}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium text-ink">
        {d.comparisonTitle}
      </h1>
      <p className="mt-4 leading-7 text-muted">{d.comparisonBody}</p>

      {ready.length === 0 ? (
        <Card className="mt-8 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-green-soft text-green">
            <MessageCircle aria-hidden="true" size={20} />
          </span>
          <h2 className="mt-4 font-semibold text-ink">{d.emptyComparisons}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {d.emptyComparisonsBody}
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-8">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center text-center">
              <Metric label={d.aligned} tone="green" value={alignedCount} />
              <span className="h-14 w-px bg-hairline" />
              <Metric
                label={d.worthDiscussing}
                tone="amber"
                value={discussCount}
              />
            </div>
            {partnerPriorityCount ? (
              <p className="mt-5 border-t border-hairline pt-4 text-center text-sm text-muted">
                {partnerPriorityCount} {d.partnerPriorities}.
              </p>
            ) : null}
          </Card>
          <div className="mt-7 space-y-3">
            {ready.map((comparison, index) => {
              const question = data.content.questions.find(
                (item) => item.id === comparison.questionId,
              );
              if (!question) return null;
              const topic = data.content.topics.find(
                (item) => item.id === question.topicId,
              );
              const discussed = discussedIds.has(question.id);
              const priorityCount = comparison.highPriorityUserIds.length;
              return (
                <Link
                  className="stagger-item flex items-center justify-between gap-4 rounded-card border border-hairline bg-white p-4 transition-[border-color,transform] duration-150 hover:border-green/40 active:scale-[0.97]"
                  href={localizedPath(
                    locale,
                    `/conversations/${question.id}`,
                  )}
                  key={question.id}
                  style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}
                >
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
                      {topic?.title}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-ink">
                      {question.text}
                    </p>
                    {priorityCount ? (
                      <p className="mt-2 text-xs leading-5 text-muted">
                        {priorityCount > 1 ? d.mattersToBoth : d.mattersToOne}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {comparison.priority === "high" ? (
                        <span
                          aria-label={d.highPriority}
                          className="size-2 rounded-full bg-green"
                        />
                      ) : null}
                      <Chip
                        tone={
                          comparison.state === "aligned"
                            ? "aligned"
                            : "discuss"
                        }
                      >
                        {comparison.state === "aligned"
                          ? d.aligned
                          : d.worthDiscussing}
                      </Chip>
                      {discussed ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green">
                          <CheckCircle2 aria-hidden="true" size={14} />
                          {d.discussed}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="shrink-0 text-green"
                    size={18}
                  />
                </Link>
              );
            })}
          </div>
        </>
      )}
    </OnboardingShell>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "amber";
  value: number;
}) {
  return (
    <div>
      <p
        className={`font-expressive text-4xl font-medium ${
          tone === "green" ? "text-green" : "text-amber-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}
