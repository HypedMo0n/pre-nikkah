"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  ImportanceRow,
  type Importance,
} from "@/components/questions/importance-row";
import { OptionCard } from "@/components/questions/option-card";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  type AnswerActionState,
} from "@/features/v3/action-types";
import { saveAnswerAction } from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import type { OptionContent } from "@/features/v3/types";
import type { Locale } from "@/lib/i18n/config";

export function V3AnswerForm({
  initialImportance,
  initialNote,
  initialOption,
  locale,
  nextHref,
  options,
  previousHref,
  questionId,
  spaceId,
}: {
  initialImportance: Importance;
  initialNote: string;
  initialOption: string;
  locale: Locale;
  nextHref: string;
  options: OptionContent[];
  previousHref?: string;
  questionId: string;
  spaceId: string;
}) {
  const d = getV3Copy(locale);
  const [optionKey, setOptionKey] = useState(initialOption);
  const [importance, setImportance] =
    useState<Importance>(initialImportance);
  const initialState: AnswerActionState = {
    status: initialOption ? "saved" : "idle",
    savedOption: initialOption || undefined,
  };
  const [state, action, pending] = useActionState(
    saveAnswerAction,
    initialState,
  );

  const currentSaved =
    state.status === "saved" && state.savedOption === optionKey;

  return (
    <form action={action} className="mt-8 space-y-7">
      <input name="locale" type="hidden" value={locale} />
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="questionId" type="hidden" value={questionId} />
      <input name="optionKey" type="hidden" value={optionKey} />
      <input name="importance" type="hidden" value={importance} />

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-semibold text-ink">
          {d.chooseAnswer}
        </legend>
        {options.map((option) => (
          <OptionCard
            checked={optionKey === option.key}
            description={option.description}
            key={option.key}
            label={option.label}
            name="visibleOption"
            onChange={() => setOptionKey(option.key)}
            value={option.key}
          />
        ))}
      </fieldset>

      <ImportanceRow
        label={d.importance}
        name="visibleImportance"
        onChange={setImportance}
        options={[
          { value: "low", label: d.importanceLow },
          { value: "medium", label: d.importanceMedium },
          { value: "high", label: d.importanceHigh },
        ]}
        value={importance}
      />

      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="private-note">
          {d.privateNote}
        </label>
        <p className="mt-1 text-xs leading-5 text-muted" id="private-note-hint">
          {d.privateNoteHint}
        </p>
        <textarea
          aria-describedby="private-note-hint"
          className="mt-3 min-h-28 w-full resize-y rounded-card border border-hairline bg-white p-4 text-base text-ink outline-none focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/20"
          defaultValue={initialNote}
          id="private-note"
          maxLength={5000}
          name="privateNote"
          placeholder={d.privateNotePlaceholder}
        />
      </div>

      <div aria-live="polite" className="min-h-5 text-sm" role="status">
        {pending ? (
          <p className="text-muted">{d.saving}</p>
        ) : state.status === "error" ? (
          <p className="text-danger">{state.message}</p>
        ) : state.status === "saved" ? (
          <p className="flex items-center gap-2 text-green">
            <Check aria-hidden="true" size={16} />
            {d.saved}
          </p>
        ) : null}
      </div>

      {currentSaved && state.savedAt ? (
        <div
          className={`rounded-card border p-4 ${
            state.partnerReady
              ? state.comparisonState === "aligned"
                ? "border-green/25 bg-green-soft text-green"
                : "border-amber/30 bg-amber-soft text-amber-ink"
              : "border-hairline bg-white text-muted"
          }`}
        >
          <p className="text-sm font-semibold">
            {state.partnerReady
              ? state.comparisonState === "aligned"
                ? d.aligned
                : d.patternWorth
              : state.partnerReady === undefined
                ? d.savedComparisonLater
                : d.savedPartnerWaiting}
          </p>
          {state.partnerReady && state.priority === "high" ? (
            <p className="mt-1 text-xs">{d.highPriority}</p>
          ) : null}
        </div>
      ) : null}

      <Button
        className="w-full"
        disabled={pending || !optionKey}
        type="submit"
      >
        {d.savePrivately}
        <Check aria-hidden="true" size={18} />
      </Button>

      <div className="grid gap-3 min-[390px]:grid-cols-2">
        {previousHref ? (
          <Link
            className={buttonClasses({ variant: "secondary", className: "w-full" })}
            href={previousHref}
          >
            <ArrowLeft aria-hidden="true" size={18} />
            {d.previous}
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        {currentSaved ? (
          <Link className={buttonClasses({ className: "w-full" })} href={nextHref}>
            {d.nextQuestion}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={buttonClasses({ className: "w-full pointer-events-none", variant: "primary" })}
          >
            {d.nextQuestion}
            <ArrowRight aria-hidden="true" size={18} />
          </span>
        )}
      </div>
    </form>
  );
}
