import { CheckCircle2, LockKeyhole, MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { ShareAnswerSheet } from "@/components/v3/share-answer-sheet";
import { SharedNoteForm } from "@/components/v3/shared-note-form";
import { markDiscussedAction, revokeAnswerAction } from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; questionId: string }>;
}) {
  const { locale, questionId } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  if (!data.overview.spaceId) notFound();
  const question = data.content.questions.find(
    (item) => item.id === questionId,
  );
  const comparison = data.comparisons.find(
    (item) => item.questionId === questionId,
  );
  if (!question || !comparison || comparison.state === "pending") notFound();
  const d = getV3Copy(locale);
  const ownAnswer = data.answers.find(
    (answer) =>
      answer.questionId === questionId && answer.userId === user.id,
  );
  const partnerAnswer = data.answers.find(
    (answer) =>
      answer.questionId === questionId && answer.userId !== user.id,
  );
  const ownOption = question.options.find(
    (option) => option.key === ownAnswer?.optionKey,
  );
  const partnerOption = question.options.find(
    (option) => option.key === partnerAnswer?.optionKey,
  );
  const shared =
    ownAnswer &&
    data.shares.some((share) => share.answer_id === ownAnswer.id);
  const discussed = data.discussions.some(
    (discussion) => discussion.question_id === questionId,
  );
  const starter =
    comparison.state === "aligned"
      ? question.starterAligned
      : question.starterDiscuss;
  const notes = data.sharedNotes.filter(
    (note) => note.question_id === questionId,
  );

  return (
    <OnboardingShell
      backHref={localizedPath(locale, "/comparisons")}
      locale={locale}
      productive
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.conversationEyebrow}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            comparison.state === "aligned"
              ? "bg-green-soft text-green"
              : "bg-amber-soft text-amber-ink"
          }`}
        >
          {comparison.state === "aligned" ? d.aligned : d.worthDiscussing}
        </span>
        {comparison.priority === "high" ? (
          <span className="rounded-full bg-green px-3 py-1 text-xs font-semibold text-white">
            {d.highPriority}
          </span>
        ) : null}
      </div>
      {comparison.highPriorityUserIds.length ? (
        <p className="mt-3 text-sm font-medium text-muted">
          {comparison.highPriorityUserIds.length > 1
            ? d.mattersToBoth
            : d.mattersToOne}
        </p>
      ) : null}
      <h1 className="font-expressive mt-5 text-3xl font-medium leading-[1.2] text-ink">
        {question.text}
      </h1>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <AnswerPanel
          answer={ownOption?.label ?? d.notShared}
          label={d.yourAnswer}
          locked={!ownOption}
        />
        <AnswerPanel
          answer={partnerOption?.label ?? d.notShared}
          label={d.partnerAnswer}
          locked={!partnerOption}
        />
      </div>

      {ownAnswer && !shared ? (
        <ShareAnswerSheet
          answerId={ownAnswer.id}
          expectedOptionKey={ownAnswer.optionKey}
          locale={locale}
          questionId={questionId}
        />
      ) : shared && ownAnswer ? (
        <>
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-green">
            <CheckCircle2 aria-hidden="true" size={17} />
            {d.shared}
          </p>
          {/* Sharing is the author's decision, so taking it back has to be too.
              Unlike sharing this needs no confirmation sheet: it only ever
              removes access, and a pause or a closed space does not block it. */}
          <form action={revokeAnswerAction} className="mt-3">
            <input name="locale" type="hidden" value={locale} />
            <input name="answerId" type="hidden" value={ownAnswer.id} />
            <input name="questionId" type="hidden" value={questionId} />
            <SubmitButton
              className="w-full"
              pendingLabel={d.saving}
              variant="ghost"
            >
              {d.revokeAnswer}
            </SubmitButton>
          </form>
        </>
      ) : null}

      <section className="mt-9 rounded-card border border-green/20 bg-green-soft p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-green">
          <MessageCircle aria-hidden="true" size={16} />
          {d.starter}
        </p>
        <p className="font-expressive mt-3 text-xl leading-8 text-ink">
          {starter}
        </p>
      </section>

      <section aria-labelledby="shared-notes" className="mt-9">
        <h2 className="text-xl font-semibold text-ink" id="shared-notes">
          {d.sharedNotes}
        </h2>
        {notes.length ? (
          <div className="mt-4 space-y-3">
            {notes.map((note) => (
              <div
                className="rounded-card border border-hairline bg-white p-4"
                key={note.id}
              >
                <p className="text-sm leading-6 text-ink">{note.body}</p>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${
                      note.author_id === user.id ? "bg-green" : "bg-amber"
                    }`}
                  />
                  {note.author_id === user.id
                    ? d.yourProgress
                    : data.overview.partner?.displayName ?? d.partnerCard}
                  {" · "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                  }).format(new Date(note.created_at))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{d.noSharedNotes}</p>
        )}
        <SharedNoteForm
          locale={locale}
          questionId={questionId}
          spaceId={data.overview.spaceId}
        />
      </section>

      <form action={markDiscussedAction} className="mt-7">
        <input name="locale" type="hidden" value={locale} />
        <input name="spaceId" type="hidden" value={data.overview.spaceId} />
        <input name="questionId" type="hidden" value={questionId} />
        <SubmitButton
          className="w-full"
          disabled={discussed}
          pendingLabel={d.saving}
        >
          {discussed ? d.discussed : d.markDiscussed}
        </SubmitButton>
      </form>
    </OnboardingShell>
  );
}

function AnswerPanel({
  answer,
  label,
  locked,
}: {
  answer: string;
  label: string;
  locked: boolean;
}) {
  return (
    <div className="rounded-card border border-hairline bg-white p-5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-3 flex items-start gap-2 text-sm font-semibold leading-6 text-ink">
        {locked ? (
          <LockKeyhole
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-muted"
            size={16}
          />
        ) : null}
        {answer}
      </p>
    </div>
  );
}
