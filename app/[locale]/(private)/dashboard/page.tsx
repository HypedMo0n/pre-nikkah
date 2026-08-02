import { ArrowRight, Link2, PauseCircle, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { JourneyPath } from "@/components/v3/journey-path";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import { getTopicStage, getVisibleTopicStage } from "@/features/v3/progress";
import { markEventReadAction } from "@/features/v3/actions";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  const d = getV3Copy(locale);

  if (data.overview.status === "none") {
    return (
      <OnboardingShell locale={locale} productive withTabBar>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
          {d.dashboardEyebrow}
        </p>
        <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">
          {d.dashboardNoSpace}
        </h1>
        <p className="mt-4 leading-7 text-muted">{d.dashboardNoSpaceBody}</p>
        <div className="mt-8 grid gap-3">
          <Link
            className={buttonClasses({ className: "w-full" })}
            href={localizedPath(locale, "/invite")}
          >
            <Link2 aria-hidden="true" size={18} />
            {d.createSpace}
          </Link>
          <Link
            className={buttonClasses({ className: "w-full", variant: "secondary" })}
            href={localizedPath(locale, "/join")}
          >
            {d.joinSpace}
          </Link>
        </div>
      </OnboardingShell>
    );
  }

  const discussedIds = new Set(
    data.discussions.map((discussion) => discussion.question_id),
  );
  const topicRows = data.content.topics.map((topic) => {
    const progress = data.progress.find((item) => item.topicId === topic.id)!;
    const questionIds = data.content.questions
      .filter((question) => question.topicId === topic.id)
      .map((question) => question.id);
    return {
      topic,
      progress,
      questionIds,
      stage: getTopicStage(progress, discussedIds, questionIds),
    };
  });
  const current =
    topicRows.find((row) => row.stage !== "discussed") ?? topicRows[0];
  // The list below names every topic, so its stages must not disclose whether
  // the partner has finished any topic other than the current shared one.
  const visibleRows = topicRows.map((row) => ({
    ...row,
    stage: getVisibleTopicStage(
      row.progress,
      discussedIds,
      row.questionIds,
      row.topic.id === current?.topic.id,
    ),
  }));
  // Counts only the comparisons this member can read, which is the current and
  // already discussed topics. A total spanning hidden topics would move when a
  // member answered a chosen question there, and that difference reveals
  // whether the partner had already answered it. Under-reporting is the price
  // of the count not being an oracle.
  const together = data.comparisons.filter(
    (comparison) => comparison.state !== "pending",
  ).length;
  const readEventIds = new Set(
    data.eventReads.map((read) => read.space_event_id),
  );
  const partnerEvents = data.events
    .filter((event) => event.actor_id !== user.id)
    .slice(0, 3);

  return (
    <OnboardingShell locale={locale} productive withTabBar>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.dashboardEyebrow}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">
        {d.dashboardTitle}
      </h1>

      <Card className="mt-7 flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink">
            {data.overview.status === "paused" ? (
              <PauseCircle aria-hidden="true" size={18} />
            ) : (
              <Users aria-hidden="true" size={18} />
            )}
            {data.overview.status === "waiting"
              ? d.waitingTitle
              : data.overview.status === "paused"
                ? d.paused
                : d.connected}
          </p>
          <p className="mt-1 text-sm text-muted">
            {data.overview.partner?.displayName ?? d.waitingBody}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`size-3 shrink-0 rounded-full ${
            data.overview.status === "active" ? "bg-green" : "bg-amber"
          }`}
        />
      </Card>

      {data.overview.status === "waiting" ? (
        <Link
          className={buttonClasses({ className: "mt-4 w-full", variant: "secondary" })}
          href={localizedPath(locale, "/invite")}
        >
          {d.regenerate}
        </Link>
      ) : null}

      <JourneyPath
        currentTopicId={current?.topic.id}
        d={d}
        discussedTopicIds={
          new Set(
            topicRows
              .filter((row) => row.stage === "discussed")
              .map((row) => row.topic.id),
          )
        }
        locale={locale}
        progress={data.progress}
        topics={data.content.topics}
      />

      {current ? (
        <Card className="mt-7 border-green/25 bg-green-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-green">
                {current.progress.own ? d.continueTopic : d.beginTopic}
              </p>
              <h2 className="font-expressive mt-2 text-2xl font-medium text-ink">
                {current.topic.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {current.progress.own}/{current.progress.total} {d.yourProgress.toLowerCase()}
                {" · "}
                {current.progress.together}/{current.progress.total} {d.togetherProgress.toLowerCase()}
              </p>
            </div>
            <Chip tone={current.stage === "ready" ? "discuss" : "aligned"}>
              {stageLabel(current.stage, d)}
            </Chip>
          </div>
          <Link
            className={buttonClasses({ className: "mt-5 w-full" })}
            href={localizedPath(locale, `/topics/${current.topic.slug}`)}
          >
            {d.continue}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </Card>
      ) : null}

      <section aria-labelledby="topic-progress" className="mt-9">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
              {d.topicsProgress}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink" id="topic-progress">
              {together} {d.questionsTogether}
            </h2>
          </div>
          <Link
            className="min-h-11 py-3 text-sm font-semibold text-green"
            href={localizedPath(locale, "/topics")}
          >
            {d.continue}
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {visibleRows.slice(0, 4).map(({ progress, stage, topic }, index) => (
            <Link
              className="stagger-item flex items-center justify-between gap-4 rounded-card border border-hairline bg-white p-4"
              href={localizedPath(locale, `/topics/${topic.slug}`)}
              key={topic.id}
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div>
                <p className="font-semibold text-ink">{topic.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {progress.own}/{progress.total} {d.yourProgress.toLowerCase()}
                </p>
              </div>
              <span className="flex items-center gap-2 text-xs font-semibold text-muted">
                {stageLabel(stage, d)}
                <ArrowRight aria-hidden="true" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {partnerEvents.length ? (
        <section aria-labelledby="recent-activity" className="mt-9">
          <h2
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted"
            id="recent-activity"
          >
            {d.recentActivity}
          </h2>
          <div className="mt-3 space-y-2">
            {partnerEvents.map((event) => (
              <form
                action={markEventReadAction}
                className="flex items-center gap-3 rounded-card border border-hairline bg-white p-4"
                key={event.id}
              >
                <input name="locale" type="hidden" value={locale} />
                <input name="eventId" type="hidden" value={event.id} />
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${
                    readEventIds.has(event.id) ? "bg-hairline" : "bg-amber"
                  }`}
                />
                <button
                  className="min-h-11 flex-1 text-left text-sm font-medium leading-6 text-ink"
                  type="submit"
                >
                  {eventMessage(event.kind, d)}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </OnboardingShell>
  );
}

function stageLabel(
  stage: ReturnType<typeof getTopicStage>,
  d: ReturnType<typeof getV3Copy>,
) {
  return {
    not_started: d.unanswered,
    in_progress: d.inProgress,
    your_part_done: d.yourPartDone,
    waiting: d.waiting,
    ready: d.ready,
    discussed: d.discussed,
  }[stage];
}

function eventMessage(
  kind: string,
  d: ReturnType<typeof getV3Copy>,
) {
  return {
    partner_joined: d.eventPartnerJoined,
    topic_ready: d.eventTopicReady,
    shared_note_added: d.eventSharedNote,
    answer_shared: d.eventAnswerShared,
  }[kind] ?? d.recentActivity;
}
