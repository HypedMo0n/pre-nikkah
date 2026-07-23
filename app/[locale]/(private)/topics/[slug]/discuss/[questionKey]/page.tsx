import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AddNoteForm } from "@/components/discuss/add-note-form";
import { MarkDiscussedForm } from "@/components/discuss/mark-discussed-form";
import { ShareAnswerButton } from "@/components/discuss/share-answer-button";
import { SharedNoteList } from "@/components/discuss/shared-note-list";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.9. Reachable only for a question the comparisons trigger has already
// resolved past 'pending' — there is nothing to discuss before both sides
// have answered, so an earlier visit redirects back to the topic.
export default async function DiscussPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; questionKey: string }>;
}) {
  const { locale: rawLocale, slug, questionKey } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const returnPath = `/${locale}/topics/${slug}/discuss/${questionKey}`;
  const { supabase, user } = await requireAuthenticatedUser(locale, returnPath);

  const { data: spaceId } = await supabase.rpc("current_space_id");
  if (!spaceId) redirect(localizedPath(locale, "/create-space"));
  const { data: space } = await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle();
  if (space?.status === "waiting") redirect(localizedPath(locale, "/invite"));

  const { data: topic } = await supabase
    .from("topics")
    .select("id, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!topic) notFound();

  const { data: question } = await supabase
    .from("questions")
    .select("id, key, text, starter_discuss")
    .eq("topic_id", topic.id)
    .eq("key", questionKey)
    .eq("is_active", true)
    .maybeSingle();
  if (!question) notFound();

  const { data: comparison } = await supabase
    .from("comparisons")
    .select("state, priority, priority_driven_by")
    .eq("space_id", spaceId)
    .eq("question_id", question.id)
    .maybeSingle();
  if (!comparison || comparison.state === "pending") {
    redirect(localizedPath(locale, `/topics/${slug}`));
  }

  const [{ data: notes }, { data: discussion }, { data: alreadyShared }, { data: partnerName }] = await Promise.all([
    supabase
      .from("shared_notes")
      .select("id, author_id, body, created_at")
      .eq("space_id", spaceId)
      .eq("question_id", question.id)
      .order("created_at"),
    supabase.from("discussions").select("discussed_at").eq("space_id", spaceId).eq("question_id", question.id).maybeSingle(),
    supabase.rpc("has_shared_own_answer", { p_question_id: question.id }),
    supabase.rpc("get_partner_display_name"),
  ]);
  const partnerLabel = partnerName ?? d["topics.partnerFallback"];
  const drivenBy = comparison.priority_driven_by === null ? null : comparison.priority_driven_by === user.id ? "me" : "partner";

  return (
    <main className="mx-auto w-full max-w-md px-7 py-8">
      <Link className="font-productive text-[13px] font-medium text-muted" href={localizedPath(locale, `/topics/${slug}/compare`)}>
        {d["topics.back"]}
      </Link>

      <div className="mt-4">
        <Chip variant={comparison.state === "discuss" ? "discuss" : "aligned"}>
          {comparison.state === "discuss" ? d["discuss.chipDiscuss"] : d["discuss.chipAligned"]}
        </Chip>
        {comparison.priority === "high" && drivenBy ? (
          <p className="mt-2 font-productive text-[13px] text-muted">
            {drivenBy === "me" ? d["answer.mattersToMe"] : d["answer.mattersToPartner"].replace("{partner}", partnerLabel)}
          </p>
        ) : null}
      </div>

      <h1 className="font-expressive mt-3 text-2xl font-normal leading-[1.25] text-ink">{question.text}</h1>

      <Card className="mt-5 bg-green-soft p-5">
        <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.10em] text-green">
          {d["discuss.starterEyebrow"]}
        </p>
        <p className="mt-2 font-productive text-[14px] leading-6 text-ink">{question.starter_discuss}</p>
      </Card>

      <div className="mt-6 space-y-3">
        <ShareAnswerButton
          alreadyShared={Boolean(alreadyShared)}
          locale={locale}
          partnerName={partnerName ?? null}
          questionId={question.id}
          returnPath={returnPath}
        />
        <MarkDiscussedForm
          discussed={Boolean(discussion)}
          locale={locale}
          questionId={question.id}
          returnPath={returnPath}
        />
        <p className="text-center font-productive text-[12.5px] text-muted">{d["discuss.footnote"]}</p>
      </div>

      <div className="mt-8">
        <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.10em] text-muted">
          {d["discuss.sharedNoteEyebrow"]}
        </p>
        <div className="mt-3">
          <SharedNoteList
            locale={locale}
            notes={(notes ?? []).map((note) => ({
              authorLabel: note.author_id === user.id ? d["topics.you"] : partnerLabel,
              body: note.body,
              createdAt: note.created_at,
              id: note.id,
            }))}
          />
        </div>
        <AddNoteForm locale={locale} questionId={question.id} returnPath={returnPath} />
      </div>
    </main>
  );
}
