import { ArrowRight, Link2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FoundationVisual, type FoundationLayerState } from "@/components/dashboard/foundation-visual";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { countQuestionsWorthDiscussing, topicComparisonSummarySchema } from "@/features/comparisons/types";
import { estimateTopicMinutes } from "@/features/topics/timing";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { QuestionType } from "@/types/domain";

const connectionSchema = z.object({ status: z.enum(["not_connected", "waiting", "active", "closed"]), connectedPartner: z.object({ privateDisplayName: z.string().nullable() }).nullable().optional() });

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ joined?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const { supabase } = await requireAuthenticatedUser(locale);
  const [connectionResult, topicResult, questionResult, progressResult, discussionResult] = await Promise.all([
    supabase.rpc("get_connection_overview"),
    supabase.from("topics").select("id,slug,name,blurb,order_index").eq("is_active", true).order("order_index"),
    supabase.from("questions").select("id,topic_id,type").eq("is_active", true),
    supabase.from("topic_progress").select("topic_id,user_id,completed_at"),
    supabase.from("guided_discussions").select("topic_id,status").eq("status", "discussed"),
  ]);
  const connection = connectionSchema.safeParse(connectionResult.data).success ? connectionSchema.parse(connectionResult.data) : { status: "not_connected" as const };
  const topics = topicResult.data ?? [];
  const questions = questionResult.data ?? [];
  const progress = progressResult.data ?? [];
  const discussedTopicIds = new Set((discussionResult.data ?? []).map((item) => item.topic_id));
  const summaries = connection.status === "active" ? (await Promise.all(topics.map(async (topic) => {
    const { data } = await supabase.rpc("get_topic_comparison_summary", { p_topic_id: topic.id });
    const parsed = topicComparisonSummarySchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  }))).filter((summary): summary is z.infer<typeof topicComparisonSummarySchema> => summary !== null) : [];
  const worthCount = countQuestionsWorthDiscussing(summaries);
  const layers: FoundationLayerState[] = topics.map((topic) => {
    if (discussedTopicIds.has(topic.id)) return "discussed";
    const completionCount = new Set(progress.filter((item) => item.topic_id === topic.id && item.completed_at).map((item) => item.user_id)).size;
    return completionCount >= 2 ? "completed" : "empty";
  });
  const d = getDictionary(locale);
  return (
    <OnboardingShell locale={locale} productive>
      {query.joined === "1" && <p className="mb-5 rounded-productive border border-aligned bg-aligned-soft p-4 text-sm font-semibold text-aligned" role="status">{d["join.success"]}</p>}
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{d["dashboard.eyebrow"]}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{d["dashboard.title"]}</h1>
      <Card className="mt-6 flex items-center justify-between gap-4 p-5">
        <div><p className="font-semibold text-ink">{connection.status === "active" ? d["dashboard.connectionReady"] : d["dashboard.connectionWaiting"]}</p><p className="mt-1 text-sm text-body">{connection.connectedPartner?.privateDisplayName ?? d["invite.body"]}</p></div>
        <span className={`size-3 shrink-0 rounded-full ${connection.status === "active" ? "bg-aligned" : "bg-discuss"}`}><span className="sr-only">{connection.status}</span></span>
      </Card>
      {connection.status !== "active" && <Link className={buttonClasses({ variant: "secondary", className: "mt-4 w-full" })} href={localizedPath(locale, "/invite")}><Link2 aria-hidden="true" size={18} />{d["dashboard.invite"]}</Link>}
      <div className="mt-6"><FoundationVisual layers={layers.length ? layers : ["empty", "empty", "empty", "empty"]} locale={locale} /></div>
      <section className="mt-7" aria-labelledby="topics-heading">
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">{d["dashboard.recommended"]}</p><h2 className="mt-1 text-xl font-semibold text-ink" id="topics-heading">{d["dashboard.faith"]}</h2></div>{connection.status === "active" && <p className="text-sm text-discuss">{worthCount} {d["dashboard.questionsWorth"]}</p>}</div>
        <div className="mt-4 space-y-3">
          {topics.map((topic) => {
            const types = questions.filter((question) => question.topic_id === topic.id).map((question) => question.type as QuestionType);
            return <Link className="flex min-h-20 items-center justify-between gap-4 rounded-productive border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`${localizedPath(locale, "/topics")}/${topic.slug}`} key={topic.id}><div><h3 className="font-semibold text-ink">{topic.name}</h3><p className="mt-1 text-sm text-ink-soft">{types.length} {d["topic.questions"]} · {estimateTopicMinutes(types)} {d["topic.minutes"]}</p></div><ArrowRight aria-hidden="true" className="shrink-0 text-ink-soft" size={18} /></Link>;
          })}
        </div>
      </section>
      {connection.status === "active" && <Link className={buttonClasses({ variant: "secondary", className: "mt-6 w-full" })} href={localizedPath(locale, "/comparisons")}>{d["comparison.title"]}<ArrowRight aria-hidden="true" size={18} /></Link>}
      <Link className={buttonClasses({ variant: "ghost", className: "mt-3 w-full" })} href={localizedPath(locale, "/settings")}>{d["settings.title"]}</Link>
    </OnboardingShell>
  );
}
