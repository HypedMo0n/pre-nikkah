import { X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AnswerForm } from "@/components/questions/answer-form";
import { buttonClasses } from "@/components/ui/button";
import { getConnectionStatus } from "@/features/answers/journey-state";
import {
  buildQuestionCadence,
  sequenceQuestionsForCadence,
} from "@/features/topics/cadence";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { logServerActionError } from "@/lib/logging/server-action-error";

const optionsSchema = z.array(z.object({ id: z.string(), label: z.string() }));

export default async function QuestionPage({ params }: { params: Promise<{ locale: string; slug: string; questionId: string }> }) {
  const { locale, slug, questionId } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: topic } = await supabase.from("topics").select("id,name").eq("slug", slug).single();
  if (!topic) notFound();
  const [questionsResult, coupleResult, connectionResult] = await Promise.all([
    supabase.from("questions").select("id,type,text,helper_text,options,sensitivity,order_index").eq("topic_id", topic.id).eq("is_active", true).order("order_index"),
    supabase.rpc("current_couple_id"),
    supabase.rpc("get_connection_overview"),
  ]);
  const orderedQuestions = sequenceQuestionsForCadence(questionsResult.data ?? []);
  const index = orderedQuestions.findIndex((question) => question.id === questionId);
  if (index < 0 || !questionsResult.data) notFound();
  const question = orderedQuestions[index];
  const previous = orderedQuestions[index - 1];
  const next = orderedQuestions[index + 1];
  const cadence = buildQuestionCadence(question, index, orderedQuestions.length);
  const d = getDictionary(locale);
  const questionBase = localizedPath(locale, `/topics/${slug}/questions`);
  const connectionStatus = getConnectionStatus(connectionResult.data);
  const coupleId = coupleResult.data;

  if (coupleResult.error || connectionResult.error || !coupleId || (connectionStatus !== "waiting" && connectionStatus !== "active")) {
    const message = connectionStatus === "waiting"
      ? d["answer.waitingJourney"]
      : connectionStatus === "closed"
        ? d["answer.closedJourney"]
        : d["answer.journeyRequired"];
    const primaryHref = localizedPath(locale, "/dashboard");
    if (connectionStatus === "active" && !coupleId) {
      logServerActionError({
        action: "answer.page_journey_invariant",
        context: { questionId },
        error: { message: "active overview with null current_couple_id" },
        userId: user.id.slice(0, 8),
      });
    }
    return (
      <main className="safe-screen min-h-[100svh] bg-background"><div className="mx-auto flex min-h-[100svh] w-full min-w-0 max-w-xl flex-col px-4 py-5 min-[360px]:px-5 sm:px-7">
        <header className="flex min-h-11 items-center justify-between"><Link aria-label={d["question.close"]} className="flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ink" href={localizedPath(locale, "/dashboard")}><X aria-hidden="true" size={20} /></Link><span className="size-11" /></header>
        <section className="flex-1 pt-8 sm:pt-10"><p className="text-xs font-semibold uppercase tracking-wider text-accent">{topic.name}</p><h1 className="font-expressive mt-3 text-3xl font-medium leading-tight text-ink">{question.text}</h1><div className="mt-6 rounded-productive border bg-card p-5"><p className="text-sm leading-6 text-body">{message}</p><div className="mt-5 grid gap-3"><Link className={buttonClasses()} href={primaryHref}>{d["answer.returnDashboard"]}</Link>{connectionStatus === "not_connected" || connectionStatus === null ? <><Link className={buttonClasses({ variant: "secondary" })} href={localizedPath(locale, "/journey")}>{d["answer.createJourney"]}</Link><Link className={buttonClasses({ variant: "secondary" })} href={localizedPath(locale, "/join")}>{d["answer.joinInvite"]}</Link></> : null}</div></div></section>
      </div></main>
    );
  }

  const { data: answer } = await supabase.from("answers").select("value,importance").eq("user_id", user.id).eq("couple_id", coupleId).eq("question_id", questionId).maybeSingle();
  const options = optionsSchema.safeParse(question.options);
  return (
    <main className="safe-screen min-h-[100svh] bg-background"><div className="mx-auto flex min-h-[100svh] w-full min-w-0 max-w-xl flex-col px-4 py-5 min-[360px]:px-5 sm:px-7">
      <header className="flex min-h-11 items-center justify-between"><Link aria-label={d["question.close"]} className="flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ink" href={localizedPath(locale, "/dashboard")}><X aria-hidden="true" size={20} /></Link><p className="text-sm font-semibold text-ink-soft">{index + 1} / {orderedQuestions.length}</p><span className="size-11" /></header>
      <div aria-label={`${index + 1} / ${orderedQuestions.length}`} aria-valuemax={orderedQuestions.length} aria-valuemin={1} aria-valuenow={index + 1} className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar"><div className="h-full rounded-full bg-primary" style={{ width: `${((index + 1) / orderedQuestions.length) * 100}%` }} /></div>
      <section className="flex-1 pt-8 sm:pt-10"><p className="text-xs font-semibold uppercase tracking-wider text-accent">{topic.name}</p><h1 className="font-expressive mt-3 text-3xl font-medium leading-tight text-ink">{question.text}</h1>{question.helper_text && <details className="mt-4 rounded-productive border bg-section p-4 text-sm text-body"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">{d["question.why"]}</summary><div className="disclosure-content"><div className="disclosure-inner"><p className="mt-2 leading-6">{question.helper_text}</p></div></div></details>}<AnswerForm cadence={cadence} complete={localizedPath(locale, `/topics/${slug}/complete`)} initialImportance={answer?.importance ?? "flexible"} initialValue={answer?.value} locale={locale} next={next ? `${questionBase}/${next.id}` : undefined} options={options.success ? options.data : null} previous={previous ? `${questionBase}/${previous.id}` : undefined} questionId={question.id} type={question.type} />{connectionStatus === "waiting" && <p className="mt-5 rounded-productive border bg-section p-4 text-xs leading-5 text-body">{d["question.privateWaitingNote"]}</p>}</section>
    </div></main>
  );
}
