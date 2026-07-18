import { Lock } from "lucide-react";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { setOwnAnswerRevealAction } from "@/features/answers/actions";
import { getQuestionComparison } from "@/features/comparisons/server";
import { saveDiscussionAction } from "@/features/discussions/actions";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

function answerText(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "Saved privately";
}

export default async function ConversationPage({ params }: { params: Promise<{ locale: string; questionId: string }> }) {
  const { locale, questionId } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/i.test(questionId)) notFound();
  const { supabase } = await requireAuthenticatedUser(locale);
  const [{ data: question }, comparison] = await Promise.all([
    supabase.from("questions").select("id,text,topic_id").eq("id", questionId).single(),
    getQuestionComparison(locale, questionId).catch(() => null),
  ]);
  if (!question || !comparison || comparison.status !== "ready") notFound();
  const { data: discussion } = await supabase.from("guided_discussions").select("shared_note,status").eq("question_id", questionId).maybeSingle();
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/comparisons")} locale={locale} productive>
      <p className="text-xs font-semibold uppercase tracking-wider text-discuss">{comparison.bucket === "aligned" ? d["comparison.aligned"] : comparison.bucket === "possible_concern" ? d["comparison.concern"] : d["comparison.worth"]}</p>
      <h1 className="mt-2 text-2xl font-semibold leading-8 text-ink">{question.text}</h1>
      <div className="mt-6 rounded-productive border bg-card p-5">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-ink-soft">{d["conversation.ownAnswer"]}</p><p className="mt-2 text-sm text-ink">{answerText(comparison.own_answer)}</p></div><form action={setOwnAnswerRevealAction}><input name="locale" type="hidden" value={locale} /><input name="questionId" type="hidden" value={questionId} /><input name="revealed" type="hidden" value={comparison.own_answer_revealed ? "false" : "true"} /><SubmitButton pendingLabel={d["common.loading"]} variant="ghost">{comparison.own_answer_revealed ? d["conversation.stop"] : d["conversation.share"]}</SubmitButton></form></div>
        <p className="mt-3 text-xs leading-5 text-ink-soft">{comparison.own_answer_revealed ? d["conversation.stopNotice"] : d["conversation.shareNotice"]}</p>
        <div className="mt-5 border-t pt-5"><p className="text-xs font-semibold text-ink-soft">{d["conversation.partnerAnswer"]}</p>{comparison.partner_answer_revealed ? <p className="mt-2 text-sm text-ink">{answerText(comparison.partner_answer)}</p> : <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft"><Lock aria-hidden="true" size={15} />{d["conversation.notShared"]}</p>}</div>
      </div>
      <form action={saveDiscussionAction} className="mt-6 space-y-4"><input name="locale" type="hidden" value={locale} /><input name="questionId" type="hidden" value={questionId} /><label className="block text-sm font-semibold text-ink" htmlFor="shared-note">{d["conversation.noteLabel"]}</label><textarea className="min-h-32 w-full resize-y rounded-productive border bg-card p-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary" defaultValue={discussion?.shared_note ?? ""} id="shared-note" maxLength={5000} name="sharedNote" /><input name="status" type="hidden" value={discussion?.status === "discussed" ? "discussing" : "discussed"} /><SubmitButton className="w-full" pendingLabel={d["common.loading"]}>{discussion?.status === "discussed" ? d["conversation.reopen"] : d["conversation.discussed"]}</SubmitButton></form>
    </OnboardingShell>
  );
}
