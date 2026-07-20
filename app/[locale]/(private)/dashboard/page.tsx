import { ArrowRight, Link2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FoundationVisual } from "@/components/dashboard/foundation-visual";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

import { activeDashboardTopics, buildTopicStages, calculateJourneyMetrics, foundationLayersFromStages, hasJourneyStarted, selectCurrentTopic } from "@/features/topics/stages";

import { estimateTopicMinutes } from "@/features/topics/timing";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { QuestionType } from "@/types/domain";

const connectionSchema = z.object({ status: z.enum(["not_connected", "waiting", "active", "closed"]), connectedPartner: z.object({ privateDisplayName: z.string().nullable() }).nullable().optional() });

const stageLabelKeys = {
  completed: "dashboard.stageCompleted",
  in_progress: "dashboard.stageInProgress",
  not_started: "dashboard.stageNotStarted",
  ready_to_discuss: "dashboard.stageReadyDiscuss",
  waiting_for_partner: "dashboard.stageWaitingPartner",
} as const;

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ joined?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [connectionResult, topicResult, questionResult, progressResult, discussionResult, answerResult, accountResult] = await Promise.all([
  const { supabase } = await requireAuthenticatedUser(locale);
  const [connectionResult, topicResult, questionResult, progressResult, discussionResult] = await Promise.all([

    supabase.rpc("get_connection_overview"),
    supabase.from("topics").select("id,slug,name,blurb,order_index").eq("is_active", true).order("order_index"),
    supabase.from("questions").select("id,topic_id,text,type,order_index").eq("is_active", true).order("order_index"),
    supabase.from("topic_progress").select("topic_id,user_id,completed_at"),

    supabase.from("guided_discussions").select("topic_id,question_id,status,updated_at"),
    supabase.from("answers").select("question_id,user_id,questions(topic_id)").order("updated_at", { ascending: false }),
    supabase.from("private_accounts").select("private_display_name").eq("id", user.id).maybeSingle(),

    supabase.from("guided_discussions").select("topic_id,status").eq("status", "discussed"),

  ]);
  const connection = connectionSchema.safeParse(connectionResult.data).success ? connectionSchema.parse(connectionResult.data) : { status: "not_connected" as const };
  const topics = topicResult.data ?? [];
  const questions = questionResult.data ?? [];

  const stages = buildTopicStages({ topics, questions, progress: progressResult.data ?? [], answers: (answerResult.data ?? []).map((answer) => ({ ...answer, questions: Array.isArray(answer.questions) ? answer.questions[0] : answer.questions })), discussions: discussionResult.data ?? [], currentUserId: user.id });
  const current = selectCurrentTopic(stages);
  const metrics = calculateJourneyMetrics(stages);
  const layers = foundationLayersFromStages(stages);
  const activeTopics = activeDashboardTopics(stages);
  const started = hasJourneyStarted(stages);

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
  const firstActionHref = current ? localizedPath(locale, `/topics/${current.topic.slug}`) : localizedPath(locale, "/topics");
  const partnerName = connection.connectedPartner?.privateDisplayName;
  const currentName = accountResult.data?.private_display_name;
  return (

    <OnboardingShell locale={locale} productive>
      {query.joined === "1" && connection.status === "active" && (
        <Card className="mb-6 border-aligned bg-aligned-soft p-5" role="status">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-aligned">{d["dashboard.connectedSuccessEyebrow"]}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{d["dashboard.connectedSuccessTitle"]}</h2>
          <p className="mt-2 text-sm leading-6 text-body">{currentName || partnerName ? `${currentName ?? d["auth.privateAccount"]} + ${partnerName ?? d["auth.privateAccount"]}` : d["dashboard.connectionReady"]}</p>
          <p className="mt-3 text-sm leading-6 text-body">{d["dashboard.connectedSuccessBody"]}</p>
          <Link className={buttonClasses({ className: "mt-5 w-full" })} href={firstActionHref}>{d["dashboard.beginOurJourney"]}<ArrowRight aria-hidden="true" size={18} /></Link>
        </Card>

    <OnboardingShell locale={locale} productive withTabBar>
      {query.joined === "1" && <p className="mb-5 rounded-productive border border-aligned bg-aligned-soft p-4 text-sm font-semibold text-aligned" role="status">{d["join.success"]}</p>}

      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{d["dashboard.eyebrow"]}</p>
      <h1 className="font-expressive mt-2 text-3xl font-medium text-ink">{d["dashboard.title"]}</h1>
      <Card className="mt-6 flex items-center justify-between gap-4 p-5">
        <div><p className="font-semibold text-ink">{connection.status === "active" ? d["dashboard.connectionReady"] : d["dashboard.connectionWaiting"]}</p><p className="mt-1 text-sm text-body">{partnerName ?? d["invite.body"]}</p></div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-xs leading-5 text-ink-soft">{label}</p><p className="mt-1 text-2xl font-semibold text-ink">{value}</p></Card>;
}

function PrimaryJourneyAction({ current, firstActionHref, locale, started }: { current: ReturnType<typeof selectCurrentTopic>; firstActionHref: string; locale: "en" | "fr"; started: boolean }) {
  const d = getDictionary(locale);
  if (!current) {
    return <Card className="mt-6 p-5"><h2 className="text-xl font-semibold text-ink">{d["dashboard.allCompleteTitle"]}</h2><p className="mt-2 text-sm leading-6 text-body">{d["dashboard.allCompleteBody"]}</p><Link className={buttonClasses({ className: "mt-5 w-full" })} href={localizedPath(locale, "/topics")}>{d["dashboard.viewJourney"]}</Link></Card>;
  }
  const title = !started ? d["dashboard.readyTitle"] : d["dashboard.continueTitle"];
  const body = !started ? d["dashboard.readyBody"] : `${current.topic.name} · ${d[stageLabelKeys[current.stage]]}`;
  const label = !started ? d["dashboard.beginJourney"] : current.stage === "not_started" ? d["dashboard.startTopic"] : current.stage === "ready_to_discuss" ? d["dashboard.reviewTogether"] : current.stage === "waiting_for_partner" ? d["dashboard.waitingPartnerAction"] : d["common.continue"];
  return <Card className="mt-6 p-5"><h2 className="text-xl font-semibold text-ink">{title}</h2><p className="mt-2 text-sm leading-6 text-body">{body}</p><p className="mt-3 text-sm text-ink-soft">{current.currentUserCompletedCount}/{current.totalQuestionCount} {d["dashboard.yourQuestions"]} · {current.bothCompletedCount}/{current.totalQuestionCount} {d["dashboard.togetherQuestions"]}</p>{current.stage === "waiting_for_partner" ? <p className="mt-5 rounded-productive bg-section p-3 text-sm font-semibold text-ink-soft">{label}</p> : <Link className={buttonClasses({ className: "mt-5 w-full" })} href={current.stage === "ready_to_discuss" ? localizedPath(locale, "/comparisons") : firstActionHref}>{label}<ArrowRight aria-hidden="true" size={18} /></Link>}</Card>;
}
