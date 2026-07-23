import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ListRow } from "@/components/ui/list-row";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const priorityRank: Record<"high" | "medium" | "low", number> = { high: 3, medium: 2, low: 1 };

// §7.8. Only questions the comparisons trigger has actually resolved past
// 'pending' appear here — a question either side hasn't answered yet has
// no pattern to show. drivenBy is read straight off comparisons.priority_
// driven_by and compared against the caller's own id, the same safe
// pattern used by the answer screen's reveal.
export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const { supabase, user } = await requireAuthenticatedUser(locale, `/${locale}/topics/${slug}/compare`);

  const { data: spaceId } = await supabase.rpc("current_space_id");
  if (!spaceId) redirect(localizedPath(locale, "/create-space"));
  const { data: space } = await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle();
  if (space?.status === "waiting") redirect(localizedPath(locale, "/invite"));

  const { data: topic } = await supabase
    .from("topics")
    .select("id, slug, title")
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
  const questionById = new Map(questionList.map((question) => [question.id, question]));

  const [{ data: comparisons }, { data: partnerName }] = await Promise.all([
    supabase
      .from("comparisons")
      .select("question_id, state, priority, priority_driven_by")
      .eq("space_id", spaceId)
      .in("question_id", questionIds)
      .neq("state", "pending"),
    supabase.rpc("get_partner_display_name"),
  ]);
  const partnerLabel = partnerName ?? d["topics.partnerFallback"];

  const rows = (comparisons ?? [])
    .map((row) => ({
      ...row,
      drivenBy: row.priority_driven_by === null ? null : row.priority_driven_by === user.id ? ("me" as const) : ("partner" as const),
      question: questionById.get(row.question_id),
    }))
    .filter((row) => row.question)
    .sort((a, b) => {
      const rankDiff = priorityRank[b.priority ?? "low"] - priorityRank[a.priority ?? "low"];
      return rankDiff !== 0 ? rankDiff : (a.question!.order_index - b.question!.order_index);
    });

  const alignedCount = rows.filter((row) => row.state === "aligned").length;
  const discussCount = rows.filter((row) => row.state === "discuss").length;
  const partnerPriorityCount = rows.filter((row) => row.priority === "high" && row.drivenBy === "partner").length;

  const firstDiscuss = rows.find((row) => row.state === "discuss");

  return (
    <main className="mx-auto w-full max-w-md px-7 py-8">
      <Link className="font-productive text-[13px] font-medium text-muted" href={localizedPath(locale, `/topics/${slug}`)}>
        {d["topics.back"]}
      </Link>
      <h1 className="font-expressive mt-4 text-3xl font-light text-ink">{d["comparison.headline"]}</h1>

      <Card className="mt-5 p-5">
        <div className="flex items-stretch">
          <div className="flex-1 text-center">
            <p className="font-expressive text-[34px] font-normal text-green">{alignedCount}</p>
            <p className="mt-1 font-productive text-[12.5px] text-muted">{d["comparison.aligned"]}</p>
          </div>
          <div aria-hidden="true" className="w-px bg-hairline" />
          <div className="flex-1 text-center">
            <p className="font-expressive text-[34px] font-normal text-amber-ink">{discussCount}</p>
            <p className="mt-1 font-productive text-[12.5px] text-muted">{d["comparison.discuss"]}</p>
          </div>
        </div>
        {partnerPriorityCount > 0 ? (
          <p className="mt-4 text-center font-productive text-[13px] text-muted">
            {(partnerPriorityCount === 1 ? d["comparison.priorityForPartnerOne"] : d["comparison.priorityForPartnerMany"])
              .replace("{count}", String(partnerPriorityCount))
              .replace("{partner}", partnerLabel)}
          </p>
        ) : null}
      </Card>

      {rows.length === 0 ? (
        <p className="mt-6 font-productive text-[14px] leading-6 text-muted">{d["comparison.empty"]}</p>
      ) : (
        <ul className="mt-6 space-y-2.5">
          {rows.map((row) => (
            <ListRow
              as={Link}
              href={localizedPath(locale, `/topics/${slug}/discuss/${row.question!.key}`)}
              interactive
              key={row.question_id}
              title={row.question!.text}
              trailing={
                <Chip dot={row.priority === "high"} variant={row.state === "aligned" ? "aligned" : "discuss"}>
                  {row.state === "aligned" ? d["comparison.aligned"] : d["comparison.discuss"]}
                </Chip>
              }
            />
          ))}
        </ul>
      )}

      <p className="mt-5 font-productive text-[12.5px] leading-5 text-muted">{d["comparison.caption"]}</p>

      {firstDiscuss ? (
        <Link
          className={buttonClasses({ className: "mt-5 w-full" })}
          href={localizedPath(locale, `/topics/${slug}/discuss/${firstDiscuss.question!.key}`)}
        >
          {d["comparison.talkThrough"]}
        </Link>
      ) : null}
    </main>
  );
}
