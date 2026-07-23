import { notFound, redirect } from "next/navigation";

import { AnswerForm } from "@/components/answers/answer-form";
import { AnswerTopBar } from "@/components/answers/answer-top-bar";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.7 + build order step 6 ("this is the product — get it feeling right
// before building around it"). Within-topic order comes from
// questions.order_index; finishing the last question in a topic returns
// to Home rather than a topic-detail screen, since that screen doesn't
// exist yet (task #10) — revisit this fallback once it does.
export default async function AnswerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; questionKey: string }>;
}) {
  const { locale: rawLocale, slug, questionKey } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const returnTo = `/${locale}/topics/${slug}/answer/${questionKey}`;
  const { supabase, user } = await requireAuthenticatedUser(locale, returnTo);

  const { data: spaceId } = await supabase.rpc("current_space_id");
  if (!spaceId) {
    redirect(localizedPath(locale, "/create-space"));
  }
  const { data: space } = await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle();
  if (space?.status === "waiting") {
    redirect(localizedPath(locale, "/invite"));
  }

  const { data: topic } = await supabase
    .from("topics")
    .select("id, slug, title")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!topic) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, key, order_index, text, options, importance_default")
    .eq("topic_id", topic.id)
    .eq("is_active", true)
    .order("order_index");
  const questionList = questions ?? [];
  const currentIndex = questionList.findIndex((question) => question.key === questionKey);
  if (currentIndex === -1) notFound();
  const current = questionList[currentIndex];
  const next = questionList[currentIndex + 1] ?? null;
  const nextHref = next
    ? localizedPath(locale, `/topics/${slug}/answer/${next.key}`)
    : localizedPath(locale, "/home");
  const exitHref = localizedPath(locale, "/home");

  const [{ data: existingAnswer }, { data: partnerName }] = await Promise.all([
    supabase
      .from("answers")
      .select("option_key, importance, private_note")
      .eq("question_id", current.id)
      .eq("space_id", spaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("get_partner_display_name"),
  ]);

  return (
    <main className="mx-auto w-full max-w-md px-7 py-6">
      <AnswerTopBar exitHref={exitHref} exitLabel={d["answer.exit"]} index={currentIndex + 1} total={questionList.length} />
      <p className="mt-6 font-productive text-[11px] font-semibold uppercase tracking-[0.12em] text-green">
        {topic.title}
      </p>
      <h1 className="font-expressive mt-2 text-2xl font-normal leading-[1.25] text-ink">{current.text}</h1>
      <AnswerForm
        existingImportance={existingAnswer?.importance ?? null}
        existingNote={existingAnswer?.private_note ?? null}
        existingOptionKey={existingAnswer?.option_key ?? null}
        importanceDefault={current.importance_default}
        locale={locale}
        nextHref={nextHref}
        options={current.options}
        partnerName={partnerName ?? null}
        questionId={current.id}
      />
    </main>
  );
}
