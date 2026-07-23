import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format/date";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.11. A record of work done, never a verdict: no alignment score, no
// readiness assessment, no summary judgement — just the date each
// conversation was discussed, how many questions in it aligned, and any
// shared notes the couple chose to keep. PDF export is out of scope for
// this milestone; the data here is already shaped so a print stylesheet
// or server-rendered PDF can be added later without reshaping anything.
export default async function RecordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const { supabase, user } = await requireAuthenticatedUser(locale, `/${locale}/record`);

  const { data: spaceId } = await supabase.rpc("current_space_id");
  if (!spaceId) redirect(localizedPath(locale, "/create-space"));
  const { data: space } = await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle();
  if (space?.status === "waiting") redirect(localizedPath(locale, "/invite"));

  const { data: topics } = await supabase
    .from("topics")
    .select("id, order_index, title")
    .eq("is_active", true)
    .order("order_index");
  const topicList = topics ?? [];

  const { data: questions } = await supabase
    .from("questions")
    .select("id, topic_id")
    .in("topic_id", topicList.map((topic) => topic.id))
    .eq("is_active", true);
  const questionList = questions ?? [];
  const topicIdByQuestionId = new Map(questionList.map((question) => [question.id, question.topic_id]));
  const questionCountByTopicId = new Map<string, number>();
  for (const question of questionList) {
    questionCountByTopicId.set(question.topic_id, (questionCountByTopicId.get(question.topic_id) ?? 0) + 1);
  }

  const [{ data: comparisons }, { data: discussions }, { data: notes }, { data: partnerName }] = await Promise.all([
    supabase.from("comparisons").select("question_id, state").eq("space_id", spaceId).eq("state", "aligned"),
    supabase.from("discussions").select("question_id, discussed_at").eq("space_id", spaceId),
    supabase.from("shared_notes").select("id, question_id, author_id, body, created_at").eq("space_id", spaceId).order("created_at"),
    supabase.rpc("get_partner_display_name"),
  ]);
  const partnerLabel = partnerName ?? d["topics.partnerFallback"];

  const alignedCountByTopicId = new Map<string, number>();
  for (const row of comparisons ?? []) {
    const topicId = topicIdByQuestionId.get(row.question_id);
    if (topicId) alignedCountByTopicId.set(topicId, (alignedCountByTopicId.get(topicId) ?? 0) + 1);
  }

  const discussedCountByTopicId = new Map<string, number>();
  const lastDiscussedAtByTopicId = new Map<string, string>();
  for (const row of discussions ?? []) {
    const topicId = topicIdByQuestionId.get(row.question_id);
    if (!topicId) continue;
    discussedCountByTopicId.set(topicId, (discussedCountByTopicId.get(topicId) ?? 0) + 1);
    const existing = lastDiscussedAtByTopicId.get(topicId);
    if (!existing || row.discussed_at > existing) lastDiscussedAtByTopicId.set(topicId, row.discussed_at);
  }

  const notesByTopicId = new Map<string, { id: string; authorLabel: string; body: string; createdAt: string }[]>();
  for (const note of notes ?? []) {
    const topicId = topicIdByQuestionId.get(note.question_id);
    if (!topicId) continue;
    const list = notesByTopicId.get(topicId) ?? [];
    list.push({
      authorLabel: note.author_id === user.id ? d["topics.you"] : partnerLabel,
      body: note.body,
      createdAt: note.created_at,
      id: note.id,
    });
    notesByTopicId.set(topicId, list);
  }

  return (
    <main className="mx-auto w-full max-w-md px-7 py-10">
      <h1 className="font-expressive text-3xl font-light text-ink">{d["record.title"]}</h1>
      <p className="mt-2 font-productive text-[15px] leading-6 text-muted">{d["record.subtitle"]}</p>

      <div className="mt-7 space-y-4">
        {topicList.map((topic) => {
          const total = questionCountByTopicId.get(topic.id) ?? 0;
          const discussedCount = discussedCountByTopicId.get(topic.id) ?? 0;
          const isFullyDiscussed = total > 0 && discussedCount >= total;
          const alignedCount = alignedCountByTopicId.get(topic.id) ?? 0;
          const lastDiscussedAt = lastDiscussedAtByTopicId.get(topic.id);
          const topicNotes = notesByTopicId.get(topic.id) ?? [];

          return (
            <Card className="p-5" key={topic.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-productive text-[15px] font-semibold text-ink">{topic.title}</h2>
                <span className="shrink-0 font-productive text-[12.5px] text-muted">
                  {isFullyDiscussed && lastDiscussedAt ? formatDate(lastDiscussedAt, locale) : d["record.inProgress"]}
                </span>
              </div>
              <p className="mt-1 font-productive text-[13px] text-muted">
                {d["record.alignedCount"].replace("{count}", String(alignedCount))}
              </p>
              {topicNotes.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-hairline pt-3">
                  {topicNotes.map((note) => (
                    <li key={note.id}>
                      <p className="font-productive text-[12.5px] font-medium text-ink">
                        {note.authorLabel} · <span className="text-muted">{formatRelativeTime(note.createdAt, locale)}</span>
                      </p>
                      <p className="mt-0.5 font-productive text-[13.5px] leading-5 text-ink">{note.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
