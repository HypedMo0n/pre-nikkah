import { ArrowRight, Link2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import {
  activeDashboardTopics,
  buildTopicStages,
  hasJourneyStarted,
  selectCurrentTopic,
  type TopicStageSummary,
} from "@/features/topics/stages";
import { estimateTopicMinutes } from "@/features/topics/timing";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary, type TranslationKey } from "@/lib/i18n/dictionaries";
import type { QuestionType } from "@/types/domain";

const connectionSchema = z.object({
  connectedPartner: z.object({ privateDisplayName: z.string().nullable() }).nullable().optional(),
  status: z.enum(["not_connected", "waiting", "active", "closed"]),
});

const stageLabelKeys = {
  completed: "dashboard.stageCompleted",
  in_progress: "dashboard.stageInProgress",
  not_started: "dashboard.stageNotStarted",
  ready_to_discuss: "dashboard.stageReadyDiscuss",
  waiting_for_partner: "dashboard.stageWaitingPartner",
} as const satisfies Record<TopicStageSummary["stage"], TranslationKey>;

type DashboardQuestion = {
  id: string;
  order_index: number | null;
  text: string | null;
  topic_id: string;
  type: QuestionType | string | null;
};

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ joined?: string; journeyAbandoned?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const query = await searchParams;
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [connectionResult, topicResult, questionResult, progressResult, discussionResult, answerResult, accountResult, checklistDefinitionsResult, checklistStateResult] = await Promise.all([
    supabase.rpc("get_connection_overview"),
    supabase.from("topics").select("id,slug,name,blurb,order_index").eq("is_active", true).order("order_index"),
    supabase.from("questions").select("id,topic_id,text,type,order_index").eq("is_active", true).order("order_index"),
    supabase.from("topic_progress").select("topic_id,user_id,completed_at"),
    supabase.from("guided_discussions").select("topic_id,question_id,status,updated_at"),
    supabase.from("answers").select("question_id,user_id,questions(topic_id)").order("updated_at", { ascending: false }),
    supabase.from("private_accounts").select("private_display_name").eq("id", user.id).maybeSingle(),
    supabase.from("checklist_definitions").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("couple_checklist_items").select("done"),
  ]);

  const parsedConnection = connectionSchema.safeParse(connectionResult.data);
  const connection = parsedConnection.success ? parsedConnection.data : { status: "not_connected" as const };
  const topics = topicResult.data ?? [];
  const questions = (questionResult.data ?? []) as DashboardQuestion[];
  const answers = (answerResult.data ?? []).map((answer) => ({
    ...answer,
    questions: Array.isArray(answer.questions) ? answer.questions[0] : answer.questions,
  }));
  const stages = buildTopicStages({
    answers,
    currentUserId: user.id,
    discussions: discussionResult.data ?? [],
    progress: progressResult.data ?? [],
    questions,
    topics,
  });
  const current = selectCurrentTopic(stages);
  const activeTopics = activeDashboardTopics(stages);
  const started = hasJourneyStarted(stages);
  const d = getDictionary(locale);
  const firstActionHref = current ? localizedPath(locale, `/topics/${current.topic.slug}`) : localizedPath(locale, "/topics");
  const partnerName = connection.connectedPartner?.privateDisplayName;
  const currentName = accountResult.data?.private_display_name;
  const checklistTotal = checklistDefinitionsResult.count ?? 0;
  const checklistDone = (checklistStateResult.data ?? []).filter((item) => item.done).length;

  return (
    <OnboardingShell locale={locale} productive withTabBar>
      <FormMessage
        message={query.journeyAbandoned === "1" ? d["waitingJourney.abandoned"] : undefined}
        status={query.journeyAbandoned === "1" ? "success" : "idle"}
      />
      {query.joined === "1" && connection.status === "active" && (
        <ConnectedSuccessCard
          currentName={currentName}
          d={d}
          firstActionHref={firstActionHref}
          partnerName={partnerName}
        />
      )}

      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{d["dashboard.eyebrow"]}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{d["dashboard.title"]}</h1>

      <Card className="mt-6 flex items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-ink">
            {connection.status === "active" ? d["dashboard.connectionReady"] : d["dashboard.connectionWaiting"]}
          </p>
          <p className="mt-1 text-sm text-body">{partnerName ?? d["invite.body"]}</p>
        </div>
        <span className={`size-3 shrink-0 rounded-full ${connection.status === "active" ? "bg-aligned" : "bg-discuss"}`}>
          <span className="sr-only">{connection.status}</span>
        </span>
      </Card>

      {connection.status !== "active" && <ConnectionActions d={d} locale={locale} />}

      {(connection.status === "active" || connection.status === "waiting") && <PrimaryJourneyAction current={current} firstActionHref={firstActionHref} locale={locale} started={started} />}

      {(connection.status === "active" || connection.status === "waiting") && (
        <UpNextSection activeTopics={activeTopics} d={d} locale={locale} questions={questions} />
      )}

      <Card className="mt-7 p-5">
        <h2 className="text-lg font-semibold text-ink">{d["dashboard.checklist"]}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{checklistDone} {d["checklist.of"]} {checklistTotal} {d["checklist.complete"]}</p>
        <Link className={buttonClasses({ variant: "secondary", className: "mt-4 w-full" })} href={localizedPath(locale, "/checklist")}>{d["common.continue"]}</Link>
      </Card>
    </OnboardingShell>
  );
}

function ConnectedSuccessCard({
  currentName,
  d,
  firstActionHref,
  partnerName,
}: {
  currentName?: string | null;
  d: Dictionary;
  firstActionHref: string;
  partnerName?: string | null;
}) {
  const displayNames = currentName || partnerName
    ? `${currentName ?? d["auth.privateAccount"]} + ${partnerName ?? d["auth.privateAccount"]}`
    : d["dashboard.connectionReady"];

  return (
    <Card className="mb-6 border-aligned bg-aligned-soft p-5" role="status">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-aligned">{d["dashboard.connectedSuccessEyebrow"]}</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">{d["dashboard.connectedSuccessTitle"]}</h2>
      <p className="mt-2 text-sm leading-6 text-body">{displayNames}</p>
      <p className="mt-3 text-sm leading-6 text-body">{d["dashboard.connectedSuccessBody"]}</p>
      <Link className={buttonClasses({ className: "mt-5 w-full" })} href={firstActionHref}>
        {d["dashboard.beginOurJourney"]}
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </Card>
  );
}

function ConnectionActions({ d, locale }: { d: Dictionary; locale: Locale }) {
  return (
    <div className="mt-4 grid gap-3">
      <Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/invite")}>
        <Link2 aria-hidden="true" size={18} />
        {d["dashboard.invite"]}
      </Link>
      <Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/join")}>
        {d["journey.joinTitle"]}
      </Link>
    </div>
  );
}

function PrimaryJourneyAction({
  current,
  firstActionHref,
  locale,
  started,
}: {
  current: ReturnType<typeof selectCurrentTopic>;
  firstActionHref: string;
  locale: Locale;
  started: boolean;
}) {
  const d = getDictionary(locale);

  // Journey complete: nothing left, so this is a terminal message with no
  // action CTA. Showing a "continue" or "check readiness" style prompt here
  // would misrepresent a finished journey as having unfinished work.
  if (!current) {
    return (
      <Card className="mt-6 p-5">
        <h2 className="text-xl font-semibold text-ink">{d["dashboard.allCompleteTitle"]}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{d["dashboard.allCompleteBody"]}</p>
      </Card>
    );
  }

  // Never started any topic yet: name the first recommended topic directly.
  if (!started) {
    return (
      <Card className="mt-6 p-5">
        <h2 className="text-xl font-semibold text-ink">{d["dashboard.beginWithLead"]} {current.topic.name}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{d["dashboard.readyBody"]}</p>
        <Link className={buttonClasses({ className: "mt-5 w-full" })} href={firstActionHref}>
          {d["dashboard.beginJourney"]}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </Card>
    );
  }

  // A prior topic was just finished and neither partner has touched this
  // one yet: this must read as a fresh "up next" moment, not the same
  // generic "continue" copy the previous topic showed.
  if (current.stage === "not_started") {
    return (
      <Card className="mt-6 p-5">
        <h2 className="text-xl font-semibold text-ink">{d["dashboard.upNextLead"]} {current.topic.name}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{current.totalQuestionCount} {d["dashboard.questionsToAnswer"]}</p>
        <Link className={buttonClasses({ className: "mt-5 w-full" })} href={firstActionHref}>
          {d["dashboard.startTopic"]}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </Card>
    );
  }

  // Mid-topic: show the real fraction answered, not just a topic name.
  if (current.stage === "in_progress") {
    return (
      <Card className="mt-6 p-5">
        <h2 className="text-xl font-semibold text-ink">{current.topic.name}</h2>
        <p className="mt-2 text-sm leading-6 text-body">
          {current.currentUserCompletedCount} {d["checklist.of"]} {current.totalQuestionCount} {d["dashboard.questionsAnswered"]}
        </p>
        <Link className={buttonClasses({ className: "mt-5 w-full" })} href={firstActionHref}>
          {d["common.continue"]}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </Card>
    );
  }

  if (current.stage === "waiting_for_partner") {
    return (
      <Card className="mt-6 p-5">
        <h2 className="text-xl font-semibold text-ink">{current.topic.name}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{d["dashboard.waitingPartnerBody"]}</p>
        <p className="mt-5 rounded-productive bg-section p-3 text-sm font-semibold text-ink-soft">{d["dashboard.waitingPartnerAction"]}</p>
      </Card>
    );
  }

  // current.stage === "ready_to_discuss"
  return (
    <Card className="mt-6 p-5">
      <h2 className="text-xl font-semibold text-ink">{current.topic.name}</h2>
      <p className="mt-2 text-sm leading-6 text-body">{d["dashboard.readyDiscussBody"]}</p>
      <Link className={buttonClasses({ className: "mt-5 w-full" })} href={localizedPath(locale, "/comparisons")}>
        {d["dashboard.reviewTogether"]}
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </Card>
  );
}

function UpNextSection({
  activeTopics,
  d,
  locale,
  questions,
}: {
  activeTopics: TopicStageSummary[];
  d: Dictionary;
  locale: Locale;
  questions: DashboardQuestion[];
}) {
  return (
    <section aria-labelledby="up-next-heading" className="mt-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">{d["dashboard.upNextEyebrow"]}</p>
      <h2 className="mt-1 text-xl font-semibold text-ink" id="up-next-heading">{d["dashboard.upNextTitle"]}</h2>
      <div className="mt-4 space-y-3">
        {activeTopics.length === 0 ? (
          <Card className="p-5">
            <p className="font-semibold text-ink">{d["dashboard.allCompleteTitle"]}</p>
            <p className="mt-2 text-sm leading-6 text-body">{d["dashboard.allCompleteBody"]}</p>
          </Card>
        ) : (
          activeTopics.map((summary) => (
            <UpNextTopicCard d={d} key={summary.topic.id} locale={locale} questions={questions} summary={summary} />
          ))
        )}
      </div>
    </section>
  );
}

function UpNextTopicCard({
  d,
  locale,
  questions,
  summary,
}: {
  d: Dictionary;
  locale: Locale;
  questions: DashboardQuestion[];
  summary: TopicStageSummary;
}) {
  const questionTypes = questions
    .filter((question) => question.topic_id === summary.topic.id)
    .map((question) => question.type as QuestionType);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-ink">{summary.topic.name}</h3>
          <p className="mt-1 text-sm text-ink-soft">
            {summary.currentUserCompletedCount}/{summary.totalQuestionCount} {d["dashboard.yourQuestions"]} · {summary.bothCompletedCount}/{summary.totalQuestionCount} {d["dashboard.togetherQuestions"]} · {estimateTopicMinutes(questionTypes)} {d["topic.minutes"]}
          </p>
        </div>
        <span className="rounded-full bg-section px-3 py-1 text-xs font-semibold text-ink-soft">
          {d[stageLabelKeys[summary.stage]]}
        </span>
      </div>

      {summary.isCurrent && summary.unansweredQuestions.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-body">
          {summary.unansweredQuestions.map((question) => (
            <li key={question.id}>• {question.text}</li>
          ))}
        </ul>
      )}

      {summary.isCurrent && summary.stage === "waiting_for_partner" && (
        <p className="mt-4 text-sm leading-6 text-body">{d["dashboard.waitingPartnerBody"]}</p>
      )}

      {summary.isCurrent && summary.stage === "ready_to_discuss" && (
        <p className="mt-4 text-sm leading-6 text-body">{d["dashboard.readyDiscussBody"]}</p>
      )}

      <Link
        className={buttonClasses({ variant: summary.isCurrent ? "primary" : "secondary", className: "mt-4 w-full" })}
        href={localizedPath(locale, `/topics/${summary.topic.slug}`)}
      >
        {summary.isCurrent ? d["common.continue"] : d["dashboard.previewTopic"]}
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </Card>
  );
}
