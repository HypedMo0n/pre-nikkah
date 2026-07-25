import { LockKeyhole } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { V3AnswerForm } from "@/components/v3/answer-form";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import type { Importance } from "@/features/v3/types";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; questionId: string }>;
}) {
  const { locale, slug, questionId } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  if (!data.overview.spaceId) {
    redirect(localizedPath(locale, "/dashboard"));
  }
  const topic = data.content.topics.find((item) => item.slug === slug);
  if (!topic) notFound();
  const questions = data.content.questions
    .filter((question) => question.topicId === topic.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const index = questions.findIndex((question) => question.id === questionId);
  if (index < 0) notFound();
  const question = questions[index];
  const ownAnswer = data.answers.find(
    (answer) =>
      answer.questionId === question.id && answer.userId === user.id,
  );
  const noteResult = ownAnswer
    ? await supabase
        .from("private_answer_notes")
        .select("body")
        .eq("answer_id", ownAnswer.id)
        .maybeSingle()
    : { data: null };
  const d = getV3Copy(locale);
  const nextHref =
    index < questions.length - 1
      ? localizedPath(
          locale,
          `/topics/${slug}/questions/${questions[index + 1].id}`,
        )
      : localizedPath(locale, `/topics/${slug}/complete`);
  const previousHref =
    index > 0
      ? localizedPath(
          locale,
          `/topics/${slug}/questions/${questions[index - 1].id}`,
        )
      : undefined;

  return (
    <OnboardingShell
      backHref={localizedPath(locale, `/topics/${slug}`)}
      locale={locale}
    >
      <div className="flex items-center justify-between gap-4 text-xs font-semibold text-muted">
        <span>
          {topic.title}
        </span>
        <span>
          {d.questionOf} {index + 1}/{questions.length}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-track"
      >
        <div
          className="h-full rounded-full bg-green transition-[width] duration-300"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>
      <h1 className="font-expressive mt-8 text-3xl font-medium leading-[1.2] text-ink">
        {question.text}
      </h1>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <LockKeyhole aria-hidden="true" size={14} />
        {d.privacyPromise}
      </p>
      <V3AnswerForm
        initialImportance={
          (ownAnswer?.importance ??
            question.defaultImportance) as Importance
        }
        initialNote={noteResult.data?.body ?? ""}
        initialOption={ownAnswer?.optionKey ?? ""}
        locale={locale}
        nextHref={nextHref}
        options={question.options}
        previousHref={previousHref}
        questionId={question.id}
        spaceId={data.overview.spaceId}
      />
    </OnboardingShell>
  );
}
