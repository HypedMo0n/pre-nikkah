import { ArrowRight, Link2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FoundationVisual, type FoundationLayerState } from "@/components/dashboard/foundation-visual";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
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
  const layers: FoundationLayerState[] = topics.map((topic) => {
    if (discussedTopicIds.has(topic.id)) return "discussed";
    const completionCount = new Set(progress.filter((item) => item.topic_id === topic.id && item.completed_at).map((item) => item.user_id)).size;
    return completionCount >= 2 ? "completed" : "empty";
  });
  const nextTopicIndex = layers.findIndex((state) => state !== "discussed");
  const nextTopic = nextTopicIndex === -1 ? null : topics[nextTopicIndex];
  const nextTopicTypes = nextTopic ? questions.filter((question) => question.topic_id === nextTopic.id).map((question) => question.type as QuestionType) : [];
  const d = getDictionary(locale);
  return (
    <OnboardingShell locale={locale} productive withTabBar>
      {query.joined === "1" && <p className="mb-5 rounded-productive border border-aligned bg-aligned-soft p-4 text-sm font-semibold text-aligned" role="status">{d["join.success"]}</p>}
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{d["dashboard.eyebrow"]}</p>
      <h1 className="font-expressive mt-2 text-3xl font-medium text-ink">{d["dashboard.title"]}</h1>
      <Card className="mt-6 flex items-center justify-between gap-4 p-5">
        <div><p className="font-semibold text-ink">{connection.status === "active" ? d["dashboard.connectionReady"] : d["dashboard.connectionWaiting"]}</p><p className="mt-1 text-sm text-body">{connection.connectedPartner?.privateDisplayName ?? d["invite.body"]}</p></div>
        <span className={`size-3 shrink-0 rounded-full ${connection.status === "active" ? "bg-aligned" : "bg-discuss"}`}><span className="sr-only">{connection.status}</span></span>
      </Card>
      {connection.status !== "active" && (
        <div className="mt-4 grid gap-3">
          <Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/invite")}><Link2 aria-hidden="true" size={18} />{d["dashboard.invite"]}</Link>
          <Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/join")}>{d["journey.joinTitle"]}</Link>
        </div>
      )}
      {nextTopic ? (
        <Link
          className="mt-6 block rounded-expressive border border-primary/30 bg-primary-soft p-5 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={`${localizedPath(locale, "/topics")}/${nextTopic.slug}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            {d["dashboard.continueLabel"]}
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {nextTopic.name}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {nextTopicTypes.length} {d["topic.questions"]} ·{" "}
            {estimateTopicMinutes(nextTopicTypes)} {d["topic.minutes"]}
          </p>
          <span className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
            {d["topic.begin"]}
            <ArrowRight aria-hidden="true" size={16} />
          </span>
        </Link>
      ) : (
        <Card className="mt-6 p-5">
          <p className="text-sm leading-6 text-body">
            {d["dashboard.allCaughtUp"]}
          </p>
        </Card>
      )}

      <div className="mt-6">
        <FoundationVisual
          layers={
            layers.length
              ? layers
              : ["empty", "empty", "empty", "empty"]
          }
          locale={locale}
          topicNames={topics.map((topic) => topic.name)}
        />
      </div>
    </OnboardingShell>
  );
}
