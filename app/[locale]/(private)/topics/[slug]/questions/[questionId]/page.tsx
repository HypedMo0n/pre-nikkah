import { X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AnswerForm } from "@/components/questions/answer-form";
import {
  buildQuestionCadence,
  sequenceQuestionsForCadence,
} from "@/features/topics/cadence";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const optionsSchema = z.array(z.object({ id: z.string(), label: z.string() }));

export default async function QuestionPage({ params }: { params: Promise<{ locale: string; slug: string; questionId: string }> }) {
  const { locale, slug, questionId } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: topic } = await supabase.from("topics").select("id,name").eq("slug", slug).single();
  if (!topic) notFound();
  const [{ data: questions }, { data: answer }] = await Promise.all([
    supabase.from("questions").select("id,type,text,helper_text,options,sensitivity,order_index").eq("topic_id", topic.id).eq("is_active", true).order("order_index"),
    supabase.from("answers").select("value").eq("user_id", user.id).eq("question_id", questionId).maybeSingle(),
  ]);
  const orderedQuestions = sequenceQuestionsForCadence(questions ?? []);
  const index = orderedQuestions.findIndex((question) => question.id === questionId);
  if (index < 0 || !questions) notFound();
  const question = orderedQuestions[index];
  const previous = orderedQuestions[index - 1];
  const next = orderedQuestions[index + 1];
  const cadence = buildQuestionCadence(question, index, orderedQuestions.length);
  const d = getDictionary(locale);
  const questionBase = localizedPath(locale, `/topics/${slug}/questions`);
  const options = optionsSchema.safeParse(question.options);
  return (
    <main className="safe-screen min-h-[100svh] bg-background"><div className="mx-auto flex min-h-[100svh] w-full min-w-0 max-w-xl flex-col px-4 py-5 min-[360px]:px-5 sm:px-7">
      <header className="flex min-h-11 items-center justify-between"><Link aria-label={d["question.close"]} className="flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ink" href={localizedPath(locale, "/dashboard")}><X aria-hidden="true" size={20} /></Link><p className="text-sm font-semibold text-ink-soft">{index + 1} / {orderedQuestions.length}</p><span className="size-11" /></header>
      <div aria-label={`${index + 1} / ${orderedQuestions.length}`} aria-valuemax={orderedQuestions.length} aria-valuemin={1} aria-valuenow={index + 1} className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar"><div className="h-full rounded-full bg-primary" style={{ width: `${((index + 1) / orderedQuestions.length) * 100}%` }} /></div>
      <section className="flex-1 pt-8 sm:pt-10"><p className="text-xs font-semibold uppercase tracking-wider text-accent">{topic.name}</p><h1 className="font-expressive mt-3 text-3xl font-medium leading-tight text-ink">{question.text}</h1>{question.helper_text && <details className="mt-4 rounded-productive border bg-section p-4 text-sm text-body"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">{d["question.why"]}</summary><p className="mt-2 leading-6">{question.helper_text}</p></details>}<AnswerForm cadence={cadence} complete={localizedPath(locale, `/topics/${slug}/complete`)} initialValue={answer?.value} locale={locale} next={next ? `${questionBase}/${next.id}` : undefined} options={options.success ? options.data : null} previous={previous ? `${questionBase}/${previous.id}` : undefined} questionId={question.id} type={question.type} /></section>
    </div></main>
  );
}
