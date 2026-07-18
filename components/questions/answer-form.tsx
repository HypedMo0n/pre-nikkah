"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { saveAnswerAction, initialAnswerSaveState } from "@/features/answers/save-action";
import { buttonClasses } from "@/components/ui/button";
import type { QuestionCadence } from "@/features/topics/cadence";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

export function AnswerForm({ cadence, complete, initialValue, locale, next, options, previous, questionId, type }: { cadence: QuestionCadence; complete: string; initialValue: unknown; locale: Locale; next?: string; options: Option[] | null; previous?: string; questionId: string; type: "single" | "scale" | "text" }) {
  const d = getDictionary(locale);
  const initialStringValue = typeof initialValue === "string" || typeof initialValue === "number" ? String(initialValue) : type === "scale" ? "3" : "";
  const [state, action, pending] = useActionState(saveAnswerAction, { ...initialAnswerSaveState, savedValue: initialValue === null || initialValue === undefined ? undefined : initialStringValue });
  const [value, setValue] = useState(initialStringValue);
  const formRef = useRef<HTMLFormElement>(null);
  const changedRef = useRef(false);

  useEffect(() => {
    if (type !== "text" || !changedRef.current || value.trim().length === 0) return;
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 700);
    return () => window.clearTimeout(timer);
  }, [type, value]);

  function saveImmediately(next: string) {
    changedRef.current = true;
    setValue(next);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <form action={action} className="mt-8" ref={formRef}>
      <input name="locale" type="hidden" value={locale} />
      <input name="questionId" type="hidden" value={questionId} />
      <input name="value" type="hidden" value={value} />
      {type === "single" && <fieldset className="grid gap-3"><legend className="sr-only">{d["question.answerChoices"]}</legend>{(options ?? []).map((option) => <label className={cn("flex min-h-14 cursor-pointer items-center rounded-expressive border p-4 text-sm font-semibold focus-within:ring-2 focus-within:ring-ink", value === option.id ? "border-primary bg-primary text-white" : "bg-card text-ink")} key={option.id}><input checked={value === option.id} className="sr-only" name="visual-answer" onChange={() => saveImmediately(option.id)} type="radio" value={option.id} />{option.label}</label>)}</fieldset>}
      {type === "scale" && <div><label className="sr-only" htmlFor="scale-answer">{d["question.scaleLabel"]}</label><input aria-valuemax={5} aria-valuemin={1} className="min-h-11 w-full accent-primary" id="scale-answer" max="5" min="1" onChange={(event) => saveImmediately(event.target.value)} type="range" value={value} /><div className="flex justify-between text-xs text-ink-soft"><span>{d["question.scaleLow"]}</span><output aria-live="polite" className="font-semibold text-primary">{value}</output><span>{d["question.scaleHigh"]}</span></div></div>}
      {type === "text" && <div><label className="sr-only" htmlFor="text-answer">{d["question.placeholder"]}</label><textarea className="min-h-40 w-full resize-y rounded-expressive border bg-card p-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary" id="text-answer" maxLength={4000} onBlur={() => value.trim() && formRef.current?.requestSubmit()} onChange={(event) => { changedRef.current = true; setValue(event.target.value); }} placeholder={d["question.placeholder"]} value={value} /></div>}
      <p aria-live="polite" className={cn("mt-3 min-h-5 text-xs", state.status === "error" ? "text-concern" : "text-ink-soft")} role="status">{pending ? d["status.saving"] : state.message}</p>
      {(cadence.pauseAfter || cadence.recommendedBreakAfter) && <aside className="mt-5 rounded-productive border border-accent/40 bg-section p-4"><p className="font-semibold text-ink">{cadence.recommendedBreakAfter ? d["question.breakTitle"] : d["question.pauseTitle"]}</p><p className="mt-1 text-sm leading-6 text-body">{cadence.recommendedBreakAfter ? d["question.breakBody"] : d["question.pauseBody"]}</p></aside>}
      <nav aria-label={d["question.navigation"]} className="mt-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {previous ? <Link aria-disabled={pending} className={buttonClasses({ variant: "secondary", className: pending ? "pointer-events-none" : undefined })} href={previous} onClick={(event) => pending && event.preventDefault()}><ChevronLeft aria-hidden="true" size={18} />{d["common.back"]}</Link> : <span />}
        <Link aria-disabled={pending || state.savedValue !== value.trim()} className={buttonClasses({ className: pending || state.savedValue !== value.trim() ? "pointer-events-none border-border bg-border text-ink-soft" : undefined })} href={next ?? complete} onClick={(event) => (pending || state.savedValue !== value.trim()) && event.preventDefault()}>{next ? d["question.next"] : d["question.finish"]}<ChevronRight aria-hidden="true" size={18} /></Link>
      </nav>
    </form>
  );
}
