import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PathCompact } from "@/components/path/path-compact";
import type { TopicProgress } from "@/components/path/topic-progress";
import { deriveTopicState } from "@/components/path/topic-progress";
import { Chip } from "@/components/ui/chip";
import { ListRow } from "@/components/ui/list-row";
import { SubmitButton } from "@/components/ui/submit-button";
import { signOutAction } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type QuestionStatus = "ready" | "yourTurn" | "waiting" | "notStarted" | "discussed";

const statusDotClass: Record<QuestionStatus, string> = {
  discussed: "bg-green",
  notStarted: "bg-hairline",
  ready: "bg-green",
  waiting: "bg-hairline",
  yourTurn: "bg-amber",
};

// §7.5. Greeting, the pair pill (→ Settings, task #14), The Path, the
// continue card for the next unanswered question, and the topic list —
// the six-screen recurring app's home base.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const { supabase, user } = await requireAuthenticatedUser(locale, `/${locale}/home`);

  const { data: spaceId } = await supabase.rpc("current_space_id");
  if (!spaceId) redirect(localizedPath(locale, "/create-space"));
  const { data: space } = await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle();
  if (space?.status === "waiting") redirect(localizedPath(locale, "/invite"));

  const [{ data: profile }, { data: partnerName }, { data: topics }, { data: progressRows }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_partner_display_name"),
    supabase.from("topics").select("id, slug, order_index, title").eq("is_active", true).order("order_index"),
    supabase.rpc("get_all_topic_progress"),
  ]);
  const topicList = topics ?? [];
  const progressByTopicId = new Map((progressRows ?? []).map((row) => [row.topic_id, row]));
  const myName = profile?.display_name ?? null;
  const partnerLabel = partnerName ?? d["topics.partnerFallback"];

  const { data: questionRows } = await supabase
    .from("questions")
    .select("id, topic_id")
    .in("topic_id", topicList.map((topic) => topic.id))
    .eq("is_active", true);
  const topicIdByQuestionId = new Map((questionRows ?? []).map((question) => [question.id, question.topic_id]));

  const { data: discussionRows } = await supabase.from("discussions").select("question_id, discussed_at").eq("space_id", spaceId);
  const lastDiscussedAtByTopicId = new Map<string, string>();
  for (const row of discussionRows ?? []) {
    const topicId = topicIdByQuestionId.get(row.question_id);
    if (!topicId) continue;
    const existing = lastDiscussedAtByTopicId.get(topicId);
    if (!existing || row.discussed_at > existing) lastDiscussedAtByTopicId.set(topicId, row.discussed_at);
  }

  const pathTopics: TopicProgress[] = topicList.map((topic) => {
    const progress = progressByTopicId.get(topic.id);
    return {
      discussed: progress?.discussed ?? 0,
      discussedAt: lastDiscussedAtByTopicId.get(topic.id) ?? null,
      mine: progress?.mine ?? 0,
      partner: progress?.partner ?? 0,
      slug: topic.slug,
      title: topic.title,
      topicId: topic.id,
      total: progress?.total ?? 0,
    };
  });

  const nextTopic = topicList.find((topic) => {
    const progress = progressByTopicId.get(topic.id);
    return progress && progress.mine < progress.total;
  });

  let continueCard: { topicTitle: string; questionText: string; href: string; mine: number; partnerCount: number; total: number } | null = null;
  if (nextTopic) {
    const nextProgress = progressByTopicId.get(nextTopic.id);
    const [{ data: nextTopicQuestions }, { data: myAnswers }] = await Promise.all([
      supabase.from("questions").select("id, key, order_index, text").eq("topic_id", nextTopic.id).eq("is_active", true).order("order_index"),
      supabase.from("answers").select("question_id").eq("space_id", spaceId).eq("user_id", user.id),
    ]);
    const myAnswerSet = new Set((myAnswers ?? []).map((answer) => answer.question_id));
    const firstUnanswered = (nextTopicQuestions ?? []).find((question) => !myAnswerSet.has(question.id));
    if (firstUnanswered && nextProgress) {
      continueCard = {
        href: localizedPath(locale, `/topics/${nextTopic.slug}/answer/${firstUnanswered.key}`),
        mine: nextProgress.mine,
        partnerCount: nextProgress.partner,
        questionText: firstUnanswered.text,
        topicTitle: nextTopic.title,
        total: nextProgress.total,
      };
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-7 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-expressive text-[28px] font-light text-ink">
          {myName ? d["home.greeting"].replace("{name}", myName) : d["home.greetingFallback"]}
        </h1>
        <Link className="shrink-0" href={localizedPath(locale, "/settings")}>
          <Chip variant="aligned">{d["home.pairPill"].replace("{you}", d["topics.you"]).replace("{partner}", partnerLabel)}</Chip>
        </Link>
      </div>

      <div className="mt-7 rounded-card border border-hairline bg-white p-5">
        <PathCompact locale={locale} partnerName={partnerName ?? null} topics={pathTopics} />
      </div>

      {continueCard ? (
        <div className="mt-6">
          <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.12em] text-green">
            {d["home.continueEyebrow"]}
          </p>
          <Link className="mt-2 block rounded-card bg-green p-5" href={continueCard.href}>
            <p className="font-productive text-[11px] font-medium uppercase tracking-[0.08em] text-white/70">
              {continueCard.topicTitle}
            </p>
            <p className="font-expressive mt-1.5 text-xl font-normal leading-[1.3] text-white">{continueCard.questionText}</p>
            <p className="mt-3 font-productive text-[12.5px] text-white/70">
              {d["home.continueProgress"]
                .replace("{mine}", String(continueCard.mine))
                .replace("{partner}", partnerLabel)
                .replace("{partnerCount}", String(continueCard.partnerCount))
                .replace("{total}", String(continueCard.total))}
            </p>
          </Link>
        </div>
      ) : null}

      <div className="mt-7">
        <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.10em] text-muted">
          {d["home.conversationsEyebrow"]}
        </p>
        <ul className="mt-3 space-y-2.5">
          {pathTopics.map((topic) => {
            const state = deriveTopicState(topic);
            const status: QuestionStatus = state.isDiscussed
              ? "discussed"
              : state.leftDone && state.rightDone
                ? "ready"
                : !state.leftDone && !state.rightDone
                  ? "notStarted"
                  : state.rightDone && !state.leftDone
                    ? "yourTurn"
                    : "waiting";
            const statusLabel =
              status === "discussed"
                ? d["topics.discussedStatus"]
                : status === "ready"
                  ? d["topics.statusReady"]
                  : status === "yourTurn"
                    ? d["topics.statusYourTurn"]
                    : status === "waiting"
                      ? d["topics.statusWaiting"]
                      : d["topics.notStarted"];
            return (
              <ListRow
                as={Link}
                href={localizedPath(locale, `/topics/${topic.slug}`)}
                interactive
                key={topic.topicId}
                leading={<span aria-hidden="true" className={`size-2 rounded-full ${statusDotClass[status]}`} />}
                subtitle={statusLabel}
                title={topic.title}
              />
            );
          })}
        </ul>
      </div>

      <form action={signOutAction} className="mt-8">
        <input name="locale" type="hidden" value={locale} />
        <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="secondary">
          {d["auth.signOut"]}
        </SubmitButton>
      </form>
    </main>
  );
}
