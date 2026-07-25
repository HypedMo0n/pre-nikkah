import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Chip } from "@/components/ui/chip";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import { getTopicStage } from "@/features/v3/progress";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  const d = getV3Copy(locale);
  const discussedIds = new Set(
    data.discussions.map((discussion) => discussion.question_id),
  );

  return (
    <OnboardingShell
      backHref={localizedPath(locale, "/dashboard")}
      locale={locale}
      productive
      withTabBar
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.appTagline}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium text-ink">
        {d.topicsProgress}
      </h1>
      <p className="mt-3 leading-7 text-muted">{d.privacyDetail}</p>

      <div className="mt-8 space-y-3">
        {data.content.topics.map((topic, index) => {
          const progress = data.progress.find(
            (item) => item.topicId === topic.id,
          )!;
          const questions = data.content.questions.filter(
            (question) => question.topicId === topic.id,
          );
          const stage = getTopicStage(
            progress,
            discussedIds,
            questions.map((question) => question.id),
          );
          const important = data.answers.some(
            (answer) =>
              answer.userId === user.id &&
              answer.importance === "high" &&
              questions.some((question) => question.id === answer.questionId),
          );
          return (
            <Link
              className="stagger-item block rounded-card border border-hairline bg-white p-5 transition-[border-color,transform] duration-150 hover:border-green/40 active:scale-[0.99]"
              href={localizedPath(locale, `/topics/${topic.slug}`)}
              key={topic.id}
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 font-semibold text-ink">
                    {topic.title}
                    {important ? (
                      <Star
                        aria-label={d.highPriority}
                        className="text-amber"
                        fill="currentColor"
                        size={15}
                      />
                    ) : null}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {topic.subtitle}
                  </p>
                  <p className="mt-3 text-xs font-medium text-muted">
                    {d.yourProgress}: {progress.own}/{progress.total}
                    {" · "}
                    {d.togetherProgress}: {progress.together}/{progress.total}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                  <Chip
                    tone={
                      stage === "ready"
                        ? "discuss"
                        : stage === "discussed"
                          ? "aligned"
                          : "neutral"
                    }
                  >
                    {label(stage, d)}
                  </Chip>
                  <ArrowRight aria-hidden="true" className="text-green" size={18} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </OnboardingShell>
  );
}

function label(
  stage: ReturnType<typeof getTopicStage>,
  d: ReturnType<typeof getV3Copy>,
) {
  return {
    not_started: d.unanswered,
    in_progress: d.inProgress,
    waiting: d.waiting,
    ready: d.ready,
    discussed: d.discussed,
  }[stage];
}
