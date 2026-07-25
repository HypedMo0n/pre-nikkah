import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ListRow } from "@/components/ui/list-row";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type QuestionStatus = "ready" | "yourTurn" | "waiting";

const statusDotClass: Record<QuestionStatus, string> = {
  ready: "bg-green",
  waiting: "bg-hairline",
  yourTurn: "bg-amber",
};

// §7.6. Status per question is derived, not stored: "your turn" from
// whether my own answer row exists, "ready to compare" / "answered ·
// waiting" from whether the comparisons row (written only by
// refresh_comparison()) has moved past 'pending' — never from reading the
// partner's answer directly.
export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const { supabase, user } = await requireAuthenticatedUser(locale, `/${locale}/topics/${slug}`);

  const { data: spaceId } = await supabase.rpc("current_space_id");
  if (!spaceId) redirect(localizedPath(locale, "/create-space"));
  const { data: space } = await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle();
  if (space?.status === "waiting") redirect(localizedPath(locale, "/invite"));

  const { data: topic } = await supabase
    .from("topics")
    .select("id, slug, order_index, title, subtitle")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!topic) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, key, order_index, text")
    .eq("topic_id", topic.id)
    .eq("is_active", true)
    .order("order_index");
  const questionList = questions ?? [];
  const questionIds = questionList.map((question) => question.id);

  const [{ data: myAnswers }, { data: comparisons }, { data: progressRows }, { data: partnerName }] = await Promise.all([
    supabase.from("answers").select("question_id").eq("space_id", spaceId).eq("user_id", user.id).in("question_id", questionIds),
    supabase.from("comparisons").select("question_id, state").eq("space_id", spaceId).in("question_id", questionIds),
    supabase.rpc("get_topic_progress", { p_topic_id: topic.id }),
    supabase.rpc("get_partner_display_name"),
  ]);

  const myAnswerSet = new Set((myAnswers ?? []).map((answer) => answer.question_id));
  const comparisonStateByQuestion = new Map((comparisons ?? []).map((row) => [row.question_id, row.state]));
  const progress = progressRows?.[0] ?? { mine: 0, partner: 0, total: questionList.length };
  const partnerLabel = partnerName ?? d["topics.partnerFallback"];

  const firstUnanswered = questionList.find((question) => !myAnswerSet.has(question.id));
  const continueHref = firstUnanswered
    ? localizedPath(locale, `/topics/${slug}/answer/${firstUnanswered.key}`)
    : localizedPath(locale, `/topics/${slug}/compare`);
  const continueLabel = firstUnanswered ? d["topics.continueAnswering"] : d["topics.seePattern"];

  return (
    <main className="mx-auto w-full max-w-md px-7 py-8">
      <Link className="font-productive text-[13px] font-medium text-muted" href={localizedPath(locale, "/home")}>
        {d["topics.back"]}
      </Link>
      <p className="mt-4 font-productive text-[11px] font-semibold uppercase tracking-[0.12em] text-green">
        {d["topics.eyebrow"].replace("{number}", String(topic.order_index).padStart(2, "0"))}
      </p>
      <h1 className="font-expressive mt-2 text-3xl font-light text-ink">{topic.title}</h1>
      <p className="mt-2 font-productive text-[15px] leading-6 text-muted">{topic.subtitle}</p>

      <div className="mt-5 flex gap-2">
        <Chip variant="aligned">
          {d["topics.you"]} · {d["topics.progress"].replace("{count}", String(progress.mine)).replace("{total}", String(progress.total))}
        </Chip>
        <Chip variant="discuss">
          {partnerLabel} · {d["topics.progress"].replace("{count}", String(progress.partner)).replace("{total}", String(progress.total))}
        </Chip>
      </div>

      <ul className="mt-6 space-y-2.5">
        {questionList.map((question) => {
          const myAnswered = myAnswerSet.has(question.id);
          const comparisonState = comparisonStateByQuestion.get(question.id);
          const status: QuestionStatus = !myAnswered ? "yourTurn" : comparisonState && comparisonState !== "pending" ? "ready" : "waiting";
          const statusLabel =
            status === "ready" ? d["topics.statusReady"] : status === "yourTurn" ? d["topics.statusYourTurn"] : d["topics.statusWaiting"];
          return (
            <ListRow
              as={Link}
              href={localizedPath(locale, `/topics/${slug}/answer/${question.key}`)}
              interactive
              key={question.id}
              leading={<span aria-hidden="true" className={`size-2 rounded-full ${statusDotClass[status]}`} />}
              subtitle={statusLabel}
              title={question.text}
            />
          );
        })}
      </ul>

      <Link className={buttonClasses({ className: "mt-7 w-full" })} href={continueHref}>
        {continueLabel}
      </Link>
    </main>
  );
}
