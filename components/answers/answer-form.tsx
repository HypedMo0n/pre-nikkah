"use client";

import Link from "next/link";
import { useActionState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextAreaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { ImportanceRow, type ImportanceLevel } from "@/components/ui/importance-row";
import { OptionCard } from "@/components/ui/option-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveAnswerAction } from "@/features/answers/actions";
import type { QuestionOption } from "@/features/answers/types";
import { initialSaveAnswerState } from "@/features/answers/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.7 + "the core loop, restated": save privately, then either reveal the
// pattern inline (partner already answered) or show the waiting state —
// both branches replace the form with a "Continue" step, never a page
// reload, so the reward lands as fast as the save itself.
export function AnswerForm({
  locale,
  questionId,
  options,
  importanceDefault,
  existingOptionKey,
  existingImportance,
  existingNote,
  partnerName,
  nextHref,
}: {
  locale: Locale;
  questionId: string;
  options: QuestionOption[];
  importanceDefault: ImportanceLevel;
  existingOptionKey: string | null;
  existingImportance: ImportanceLevel | null;
  existingNote: string | null;
  partnerName: string | null;
  nextHref: string;
}) {
  const [state, action] = useActionState(saveAnswerAction, initialSaveAnswerState);
  const d = getDictionary(locale);

  if (state.status === "success") {
    const reveal = state.reveal;
    return (
      <div className="mt-8 space-y-5">
        {reveal.kind === "waiting" ? (
          <p className="font-productive text-[15px] leading-6 text-ink">
            {partnerName ? d["answer.savedWaiting"].replace("{partner}", partnerName) : d["answer.savedWaitingFallback"]}
          </p>
        ) : (
          <div className="space-y-3">
            <Chip dot={reveal.priority === "high"} variant={reveal.state === "aligned" ? "aligned" : "discuss"}>
              {reveal.state === "aligned" ? d["comparison.aligned"] : d["comparison.discuss"]}
            </Chip>
            {reveal.priority === "high" && reveal.drivenBy ? (
              <p className="font-productive text-[13px] text-muted">
                {reveal.drivenBy === "me" || !partnerName
                  ? d["answer.mattersToMe"]
                  : d["answer.mattersToPartner"].replace("{partner}", partnerName)}
              </p>
            ) : null}
          </div>
        )}
        <Link className={buttonClasses({ className: "w-full" })} href={nextHref}>
          {d["answer.continue"]}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-6">
      <input name="locale" type="hidden" value={locale} />
      <input name="questionId" type="hidden" value={questionId} />
      <div className="space-y-2.5" role="radiogroup">
        {options.map((option) => (
          <OptionCard
            key={option.key}
            defaultChecked={existingOptionKey === option.key}
            description={option.description}
            label={option.label}
            name="optionKey"
            required
            value={option.key}
          />
        ))}
      </div>
      <ImportanceRow
        defaultValue={existingImportance ?? importanceDefault}
        eyebrow={d["answer.eyebrow"]}
        labels={{ low: d["importance.low"], medium: d["importance.medium"], high: d["importance.high"] }}
        name="importance"
      />
      <TextAreaField
        defaultValue={existingNote ?? ""}
        dashed
        maxLength={2000}
        name="privateNote"
        placeholder={d["answer.notePlaceholder"]}
      />
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <div className="space-y-2">
        <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
          {d["answer.save"]}
        </SubmitButton>
        <p className="text-center font-productive text-[12.5px] text-muted">{d["answer.footnote"]}</p>
      </div>
    </form>
  );
}
