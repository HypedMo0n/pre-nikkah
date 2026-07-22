import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { getQuestionComparison } from "@/features/comparisons/server";
import { groupComparisons } from "@/features/comparisons/grouping";
import { buildTopicStages, selectCurrentTopic } from "@/features/topics/stages";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const labels = (d: ReturnType<typeof getDictionary>) => ({ aligned: d["comparison.aligned"], worth_discussing: d["comparison.worth"], possible_concern: d["comparison.concern"] }) as const;

export default async function ComparisonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [questionResult, topicResult, answerResult, discussionResult, progressResult] = await Promise.all([
    supabase.from("questions").select("id,text,topic_id,order_index,type").eq("is_active", true).order("order_index"),
    supabase.from("topics").select("id,slug,name,blurb,order_index").eq("is_active", true).order("order_index"),
    supabase.from("answers").select("question_id,user_id,questions(topic_id)").order("updated_at", { ascending: false }),
    supabase.from("guided_discussions").select("question_id,topic_id,status,updated_at"),
    supabase.from("topic_progress").select("topic_id,user_id,completed_at"),
  ]);
  const topics = topicResult.data ?? [];
  const questions = questionResult.data ?? [];
  const answers = (answerResult.data ?? []).map((answer) => ({ question_id: answer.question_id, user_id: answer.user_id, questions: Array.isArray(answer.questions) ? answer.questions[0] : answer.questions }));
  const stages = buildTopicStages({ topics, questions, progress: progressResult.data ?? [], answers, discussions: discussionResult.data ?? [], currentUserId: user.id });
  const currentTopicId = selectCurrentTopic(stages)?.topic.id ?? null;
  // The answers table intentionally exposes only the current user's rows.
  // Eligibility must therefore come from the privacy-preserving RPC rather
  // than attempting to infer a partner answer from client-readable rows.
  const comparisonEntries = await Promise.all(questions.map(async (question) => {
    try { return [question.id, await getQuestionComparison(locale, question.id)] as const; } catch { return null; }
  }));
  const comparisonMap = new Map(comparisonEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null));
  const { readyGroups, reviewedGroups } = groupComparisons({ topics, questions, answers, discussions: discussionResult.data ?? [], comparisons: comparisonMap, currentTopicId });
  const d = getDictionary(locale);
  const hasReady = readyGroups.length > 0;
  const hasReviewed = reviewedGroups.length > 0;
  return (
    <OnboardingShell locale={locale} productive withTabBar>
      <h1 className="font-expressive text-3xl font-medium text-ink">{d["comparison.title"]}</h1>
      <p className="mt-3 text-sm leading-6 text-body">{d["comparison.body"]}</p>
      <section className="mt-7" aria-labelledby="ready-comparisons">
        <h2 className="text-xl font-semibold text-ink" id="ready-comparisons">{d["comparison.readyTitle"]}</h2>
        {!hasReady && <EmptyComparisonCard title={hasReviewed ? d["comparison.caughtUpTitle"] : d["comparison.emptyTitle"]} body={hasReviewed ? d["comparison.caughtUpBody"] : d["comparison.emptyBody"]} />}
        <div className="mt-4 space-y-3">{readyGroups.map((group, index) => <div className="stagger-item" key={group.topic.id} style={{ animationDelay: `${Math.min(index, 4) * 45}ms` }}><ComparisonGroup group={group} labels={labels(d)} locale={locale} mode="ready" /></div>)}</div>
      </section>
      {hasReviewed && (
        <section className="mt-8" aria-labelledby="reviewed-comparisons">
          <h2 className="text-xl font-semibold text-ink" id="reviewed-comparisons">{d["comparison.reviewedTitle"]}</h2>
          <div className="mt-4 space-y-3">{reviewedGroups.map((group, index) => <div className="stagger-item" key={group.topic.id} style={{ animationDelay: `${Math.min(index, 4) * 45}ms` }}><ComparisonGroup group={group} labels={labels(d)} locale={locale} mode="reviewed" /></div>)}</div>
        </section>
      )}
    </OnboardingShell>
  );
}

function EmptyComparisonCard({ title, body }: { title: string; body: string }) {
  return <Card className="mt-4 p-5"><p className="font-semibold text-ink">{title}</p><p className="mt-2 text-sm leading-6 text-body">{body}</p></Card>;
}

function ComparisonGroup({ group, labels, locale, mode }: { group: ReturnType<typeof groupComparisons>["readyGroups"][number]; labels: Record<string, string>; locale: "en" | "fr"; mode: "ready" | "reviewed" }) {
  const rows = mode === "ready" ? group.ready : group.reviewed;
  const d = getDictionary(locale);
  return (
    <details className="rounded-productive border bg-card p-4 group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span><span className="block font-semibold text-ink">{group.topic.name}</span><span className="mt-1 block text-sm text-ink-soft">{group.ready.length} {d["comparison.readyCount"]} · {group.reviewed.length} {d["comparison.reviewedCount"]}</span></span>
        <span className="rounded-full bg-section px-3 py-1 text-xs font-semibold text-primary group-open:hidden">{d["comparison.expand"]}</span>
        <span className="hidden rounded-full bg-section px-3 py-1 text-xs font-semibold text-primary group-open:inline">{d["comparison.collapse"]}</span>
      </summary>
      <div className="disclosure-content">
        <div className="disclosure-inner">
          <div className="mt-4 space-y-3">
            {rows.map((row) => <div className="flex items-center justify-between gap-3 rounded-productive border bg-background p-3" key={row.question.id}><div><h3 className="text-sm font-semibold leading-6 text-ink">{row.question.text}</h3><p className="mt-1 text-xs font-semibold text-ink-soft">{labels[row.bucket]}</p></div><Link aria-label={`${d["comparison.open"]}: ${row.question.text}`} className="flex min-h-11 shrink-0 items-center gap-2 rounded-productive px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" href={`${localizedPath(locale, "/conversations")}/${row.question.id}`}>{d["comparison.view"]}<ArrowRight aria-hidden="true" size={16} /></Link></div>)}
          </div>
        </div>
      </div>
    </details>
  );
}
