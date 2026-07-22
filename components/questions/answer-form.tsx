"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
type AnswerFormProps = {
  cadence: QuestionCadence;
  complete: string;
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
  const router = useRouter();

  const initialStringValue =
    typeof initialValue === "string" || typeof initialValue === "number"
      ? String(initialValue)
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
      {type === "single" && <fieldset className="grid gap-3"><legend className="sr-only">{d["question.answerChoices"]}</legend>{(options ?? []).map((option) => <label className={cn("flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-expressive border p-4 text-sm font-semibold focus-within:ring-2 focus-within:ring-ink", value === option.id ? "border-primary bg-primary text-white" : "bg-card text-ink")} key={option.id}><input checked={value === option.id} className="sr-only" name="visual-answer" onChange={() => saveImmediately(option.id)} type="radio" value={option.id} /><span>{option.label}</span>{value === option.id ? <Check aria-hidden="true" className="shrink-0" size={20} strokeWidth={3} /> : null}</label>)}</fieldset>}
      {type === "scale" && <fieldset><legend className="sr-only">{d["question.scaleLabel"]}</legend><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((number) => <label className={cn("flex min-h-12 cursor-pointer items-center justify-center rounded-productive border text-sm font-semibold focus-within:ring-2 focus-within:ring-ink", value === String(number) ? "border-primary bg-primary text-white" : "bg-card text-ink")} key={number}><input checked={value === String(number)} className="sr-only" name="visual-answer" onChange={() => saveImmediately(String(number))} type="radio" value={number} />{number}</label>)}</div><div className="mt-2 flex justify-between text-xs text-ink-soft"><span>{d["question.scaleLow"]}</span><span>{d["question.scaleHigh"]}</span></div></fieldset>}
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

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3" role="status" aria-live="polite"><p className={cn("text-xs", state.status === "error" ? "text-concern" : "text-ink-soft")}>{pending ? d["status.saving"] : state.message}</p>{state.status === "error" && value.trim() ? <button className="min-h-11 rounded-productive px-3 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary" onClick={() => formRef.current?.requestSubmit()} type="button">{d["common.retry"]}</button> : null}</div>
      {(state.status === "journey_required" || state.status === "question_unavailable") && (
        <Link className={buttonClasses({ className: "mt-4 w-full" })} href={state.redirectTo}>
          {state.status === "journey_required" ? d["answer.returnDashboard"] : d["answer.returnDashboard"]}
        </Link>
      )}
      {(cadence.pauseAfter || cadence.recommendedBreakAfter) && <aside className="mt-5 rounded-productive border border-accent/40 bg-section p-4"><p className="font-semibold text-ink">{cadence.recommendedBreakAfter ? d["question.breakTitle"] : d["question.pauseTitle"]}</p><p className="mt-1 text-sm leading-6 text-body">{cadence.recommendedBreakAfter ? d["question.breakBody"] : d["question.pauseBody"]}</p></aside>}
      <nav aria-label={d["question.navigation"]} className="mt-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {previous ? <button className={buttonClasses({ variant: "secondary", className: "w-full" })} disabled={pending} onClick={() => router.push(previous)} type="button"><ChevronLeft aria-hidden="true" size={18} />{d["common.back"]}</button> : <span />}
        <button className={buttonClasses({ className: "w-full" })} disabled={pending || state.status !== "saved" || state.savedValue !== value.trim()} onClick={() => router.push(next ?? complete)} type="button">{next ? d["question.next"] : d["question.finish"]}<ChevronRight aria-hidden="true" size={18} /></button>
      </nav>
    </form>
  );
}
