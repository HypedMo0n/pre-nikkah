import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buildTopicStages } from "@/features/topics/stages";
import { estimateTopicMinutes } from "@/features/topics/timing";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { QuestionType } from "@/types/domain";

const stageLabelKeys = {
  completed: "dashboard.stageCompleted",
  in_progress: "dashboard.stageInProgress",
  not_started: "dashboard.stageNotStarted",
  ready_to_discuss: "dashboard.stageReadyDiscuss",
  waiting_for_partner: "dashboard.stageWaitingPartner",
} as const;

export default async function TopicsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [topicResult, questionResult, progressResult, discussionResult, answerResult] = await Promise.all([
    supabase.from("topics").select("id,slug,name,blurb,order_index").eq("is_active", true).order("order_index"),
    supabase.from("questions").select("id,topic_id,text,type,order_index").eq("is_active", true).order("order_index"),
    supabase.from("topic_progress").select("topic_id,user_id,completed_at"),
    supabase.from("guided_discussions").select("topic_id,question_id,status,updated_at"),
    supabase.from("answers").select("question_id,user_id,importance,questions(topic_id)").eq("user_id", user.id),
  ]);
  const topics = topicResult.data ?? [];
  const questions = questionResult.data ?? [];
  const stages = buildTopicStages({ topics, questions, progress: progressResult.data ?? [], answers: (answerResult.data ?? []).map((answer) => ({ ...answer, questions: Array.isArray(answer.questions) ? answer.questions[0] : answer.questions })), discussions: discussionResult.data ?? [], currentUserId: user.id });
  // Own-answers only, never the partner's: matches the reveal-on-consent
  // model. A topic is marked important if this user rated any answer in it
  // essential or non-negotiable, regardless of whether that specific answer
  // has been revealed.
  const importantTopicIds = new Set(
    (answerResult.data ?? [])
      .filter((answer) => answer.importance === "essential" || answer.importance === "non_negotiable")
      .map((answer) => (Array.isArray(answer.questions) ? answer.questions[0] : answer.questions)?.topic_id)
      .filter((topicId): topicId is string => Boolean(topicId)),
  );
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/dashboard")} locale={locale} productive withTabBar>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{d["topics.eyebrow"]}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{d["topics.title"]}</h1>
      <p className="mt-3 text-sm leading-6 text-body">{d["topics.body"]}</p>
      <div className="mt-7 space-y-3">
        {stages.map((summary, index) => {
          const types = questions.filter((question) => question.topic_id === summary.topic.id).map((question) => question.type as QuestionType);
          return <Link className="block rounded-productive border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={localizedPath(locale, `/topics/${summary.topic.slug}`)} key={summary.topic.id}><Card className="border-0 bg-transparent p-0 shadow-none"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{index + 1}</p><h2 className="mt-1 flex items-center gap-1.5 font-semibold text-ink">{summary.topic.name}{importantTopicIds.has(summary.topic.id) && <Star aria-label={d["topics.importantBadge"]} className="text-accent" fill="currentColor" size={14} />}</h2><p className="mt-1 text-sm text-ink-soft">{summary.currentUserCompletedCount}/{summary.totalQuestionCount} {d["dashboard.yourQuestions"]} · {summary.bothCompletedCount}/{summary.totalQuestionCount} {d["dashboard.togetherQuestions"]} · {estimateTopicMinutes(types)} {d["topic.minutes"]}</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-section px-3 py-1 text-xs font-semibold text-ink-soft">{d[stageLabelKeys[summary.stage]]}</span><ArrowRight aria-hidden="true" size={18} /></div></div></Card></Link>;
        })}
      </div>
    </OnboardingShell>
  );
}