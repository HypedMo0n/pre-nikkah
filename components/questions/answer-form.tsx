"use client";

import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { saveAnswerAction } from "@/features/answers/save-action";
import { initialAnswerSaveState, type AnswerSaveState } from "@/features/answers/types";
import { buttonClasses } from "@/components/ui/button";
import type { QuestionCadence } from "@/features/topics/cadence";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

type Option = {
  id: string;
  label: string;
};

type Importance = "flexible" | "important" | "essential" | "non_negotiable";
type DiscussionPreference = "together" | "professional" | "outside_app";

type AnswerFormProps = {
  cadence: QuestionCadence;
  complete: string;
  initialDiscussionPreference?: DiscussionPreference | null;
  initialImportance?: Importance;
  initialValue: unknown;
  locale: Locale;
  next?: string;
  options: Option[] | null;
  previous?: string;
  questionId: string;
  type: "single" | "scale" | "text";
};

export function AnswerForm({
  cadence,
  complete,
  initialDiscussionPreference = null,
  initialImportance = "flexible",
  initialValue,
  locale,
  next,
  options,
  previous,
  questionId,
  type,
}: AnswerFormProps) {
  const d = getDictionary(locale);

  const initialStringValue =
    typeof initialValue === "string" || typeof initialValue === "number"
      ? String(initialValue)
      : type === "scale"
        ? "3"
        : "";

  const initialState: AnswerSaveState = {
    status: initialAnswerSaveState.status,
    savedValue:
      initialValue === null || initialValue === undefined
        ? undefined
        : initialStringValue,
  };

  const [state, action, pending] = useActionState(
    saveAnswerAction,
    initialState,
  );

  const [value, setValue] = useState(initialStringValue);
  const [importance, setImportance] = useState<Importance>(initialImportance);
  const [discussionPreference, setDiscussionPreference] = useState<DiscussionPreference | null>(initialDiscussionPreference);
  const formRef = useRef<HTMLFormElement>(null);
  const changedRef = useRef(false);

  useEffect(() => {
    if (
      type !== "text" ||
      !changedRef.current ||
      value.trim().length === 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [type, value]);

  function saveImmediately(nextValue: string) {
    changedRef.current = true;
    setValue(nextValue);

    window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 0);
  }

  return (
    <form action={action} className="mt-8" ref={formRef}>
      <input name="locale" type="hidden" value={locale} />
      <input name="questionId" type="hidden" value={questionId} />
      <input name="value" type="hidden" value={value} />
      <input name="importance" type="hidden" value={importance} />
      <input name="discussionPreference" type="hidden" value={discussionPreference ?? ""} />
      {type === "single" && <fieldset className="grid gap-3"><legend className="sr-only">{d["question.answerChoices"]}</legend>{(options ?? []).map((option) => <label className={cn("flex min-h-14 cursor-pointer items-center rounded-expressive border p-4 text-sm font-semibold focus-within:ring-2 focus-within:ring-ink", value === option.id ? "border-primary bg-primary text-white" : "bg-card text-ink")} key={option.id}><input checked={value === option.id} className="sr-only" name="visual-answer" onChange={() => saveImmediately(option.id)} type="radio" value={option.id} />{option.label}</label>)}</fieldset>}
      {type === "scale" && <div><label className="sr-only" htmlFor="scale-answer">{d["question.scaleLabel"]}</label><input aria-valuemax={5} aria-valuemin={1} className="min-h-11 w-full accent-primary" id="scale-answer" max="5" min="1" onChange={(event) => saveImmediately(event.target.value)} type="range" value={value} /><div className="flex justify-between text-xs text-ink-soft"><span>{d["question.scaleLow"]}</span><output aria-live="polite" className="font-semibold text-primary">{value}</output><span>{d["question.scaleHigh"]}</span></div></div>}
      {type === "text" && <div><label className="sr-only" htmlFor="text-answer">{d["question.placeholder"]}</label><textarea className="min-h-40 w-full resize-y rounded-expressive border bg-card p-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary" id="text-answer" maxLength={4000} onBlur={() => value.trim() && formRef.current?.requestSubmit()} onChange={(event) => { changedRef.current = true; setValue(event.target.value); }} placeholder={d["question.placeholder"]} value={value} /></div>}

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{d["question.importanceLabel"]}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["flexible", "important", "essential", "non_negotiable"] as const).map((level) => (
            <button
              aria-pressed={importance === level}
              className={cn(
                "min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                importance === level ? "border-accent bg-section text-ink" : "border-border bg-card text-ink-soft",
              )}
              key={level}
              onClick={() => {
                setImportance(level);
                changedRef.current = true;
                if (value.trim().length > 0) {
                  window.setTimeout(() => formRef.current?.requestSubmit(), 0);
                }
              }}
              type="button"
            >
              {d[`question.importance.${level}`]}
            </button>
          ))}
        </div>
      </fieldset>

      <details className="mt-4 rounded-productive border bg-section p-4 text-sm text-body">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-1 font-semibold text-primary">
          <MessageCircle aria-hidden="true" size={16} />
          {d["question.discussionPreferenceLabel"]}
        </summary>
        <div className="mt-3 grid gap-2">
          {(["together", "professional", "outside_app"] as const).map((option) => (
            <button
              aria-pressed={discussionPreference === option}
              className={cn(
                "flex min-h-11 items-center rounded-productive border px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                discussionPreference === option ? "border-primary bg-primary-soft text-ink" : "border-border bg-card text-ink-soft",
              )}
              key={option}
              onClick={() => {
                setDiscussionPreference(discussionPreference === option ? null : option);
                changedRef.current = true;
                if (value.trim().length > 0) {
                  window.setTimeout(() => formRef.current?.requestSubmit(), 0);
                }
              }}
              type="button"
            >
              {d[`question.discussionPreference.${option}`]}
            </button>
          ))}
        </div>
      </details>
      <p aria-live="polite" className={cn("mt-3 min-h-5 text-xs", state.status === "error" ? "text-concern" : "text-ink-soft")} role="status">{pending ? d["status.saving"] : state.message}</p>
      {(state.status === "journey_required" || state.status === "question_unavailable") && (
        <Link className={buttonClasses({ className: "mt-4 w-full" })} href={state.redirectTo}>
          {state.status === "journey_required" ? d["answer.returnDashboard"] : d["answer.returnDashboard"]}
        </Link>
      )}
      {(cadence.pauseAfter || cadence.recommendedBreakAfter) && <aside className="mt-5 rounded-productive border border-accent/40 bg-section p-4"><p className="font-semibold text-ink">{cadence.recommendedBreakAfter ? d["question.breakTitle"] : d["question.pauseTitle"]}</p><p className="mt-1 text-sm leading-6 text-body">{cadence.recommendedBreakAfter ? d["question.breakBody"] : d["question.pauseBody"]}</p></aside>}
      <nav aria-label={d["question.navigation"]} className="mt-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {previous ? <Link aria-disabled={pending} className={buttonClasses({ variant: "secondary", className: pending ? "pointer-events-none" : undefined })} href={previous} onClick={(event) => pending && event.preventDefault()}><ChevronLeft aria-hidden="true" size={18} />{d["common.back"]}</Link> : <span />}
        <Link aria-disabled={pending || state.status !== "saved" || state.savedValue !== value.trim()} className={buttonClasses({ className: pending || state.status !== "saved" || state.savedValue !== value.trim() ? "pointer-events-none border-border bg-border text-ink-soft" : undefined })} href={next ?? complete} onClick={(event) => (pending || state.status !== "saved" || state.savedValue !== value.trim()) && event.preventDefault()}>{next ? d["question.next"] : d["question.finish"]}<ChevronRight aria-hidden="true" size={18} /></Link>
      </nav>
    </form>
  );
}