"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useActionState, useEffect } from "react";

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
import { usePrefersReducedMotion } from "@/lib/motion/use-reduced-motion";

// §7.7 + "the core loop, restated": save privately, then either reveal the
// pattern inline (partner already answered) or show the waiting state —
// both branches replace the form with a "Continue" step, never a page
// reload, so the reward lands as fast as the save itself.
//
// §9 #4/#5: the form exits opacity+translateY(-8px) over 180ms, the
// reveal enters over 250ms (exit faster than enter), and a shared
// AnimatePresence sequences the two so the reveal never overlaps the
// form's exit. The pattern chip lands with its own spring on top of that
// entrance. One soft haptic fires the moment the reveal mounts. Reduced
// motion drops every transform to a flat 200ms opacity crossfade, per
// §9's own reduced-motion block, and skips the chip's spring entirely.
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
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (state.status === "success" && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  }, [state]);

  const exitTransition = reduced ? { duration: 0.2 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] };
  const enterTransition = reduced ? { duration: 0.2 } : { duration: 0.25, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] };
  const exitMotion = reduced ? { opacity: 0 } : { opacity: 0, y: -8 };
  const enterFrom = reduced ? { opacity: 0 } : { opacity: 0, y: 8 };

  return (
    <AnimatePresence mode="wait">
      {state.status === "success" ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 space-y-5"
          initial={enterFrom}
          key="reveal"
          transition={enterTransition}
        >
          {state.reveal.kind === "waiting" ? (
            <p className="font-productive text-[15px] leading-6 text-ink">
              {partnerName ? d["answer.savedWaiting"].replace("{partner}", partnerName) : d["answer.savedWaitingFallback"]}
            </p>
          ) : (
            <div className="space-y-3">
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
                transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.4 }}
              >
                <Chip dot={state.reveal.priority === "high"} variant={state.reveal.state === "aligned" ? "aligned" : "discuss"}>
                  {state.reveal.state === "aligned" ? d["comparison.aligned"] : d["comparison.discuss"]}
                </Chip>
              </motion.div>
              {state.reveal.priority === "high" && state.reveal.drivenBy ? (
                <p className="font-productive text-[13px] text-muted">
                  {state.reveal.drivenBy === "me" || !partnerName
                    ? d["answer.mattersToMe"]
                    : d["answer.mattersToPartner"].replace("{partner}", partnerName)}
                </p>
              ) : null}
            </div>
          )}
          <Link className={buttonClasses({ className: "w-full" })} href={nextHref}>
            {d["answer.continue"]}
          </Link>
        </motion.div>
      ) : (
        <motion.form
          action={action}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 space-y-6"
          exit={exitMotion}
          initial={false}
          key="form"
          transition={exitTransition}
        >
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
        </motion.form>
      )}
    </AnimatePresence>
  );
}
