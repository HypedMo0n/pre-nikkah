"use client";

import { LockKeyhole, X } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  initialActionState,
  type ActionState,
} from "@/features/v3/action-types";
import { shareAnswerAction } from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import type { Locale } from "@/lib/i18n/config";

export function ShareAnswerSheet({
  answerId,
  expectedOptionKey,
  locale,
  questionId,
}: {
  answerId: string;
  expectedOptionKey: string;
  locale: Locale;
  questionId: string;
}) {
  const d = getV3Copy(locale);
  const [state, formAction] = useActionState(
    shareAnswerAction,
    initialActionState,
  );
  // The dialog stays open only while the action has not answered the click
  // that opened it. Any outcome closes it: on success the page now shows the
  // share, and on ANSWER_CHANGED the answer moved on while this was open, so
  // leaving the dialog up would let a second click share a value the person
  // never saw — it does not display the option itself. Derived rather than
  // set from an effect, so reopening after an error works without resetting
  // anything.
  const [openedWith, setOpenedWith] = useState<ActionState | null>(null);
  const open = openedWith !== null && openedWith === state;
  return (
    <>
      <p className="mt-4 text-xs leading-5 text-muted">{d.shareWarning}</p>
      {state.status === "error" && state.message ? (
        <p
          className="mt-3 rounded-card border border-amber/30 bg-amber-soft p-3 text-sm leading-6 text-amber-ink"
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button
        className="mt-3 w-full"
        onClick={() => setOpenedWith(state)}
        variant="secondary"
      >
        {d.shareAnswer}
      </Button>
      {open ? (
        <div
          aria-labelledby="share-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
          role="dialog"
        >
          <div className="w-full rounded-card border border-hairline bg-ivory p-6 shadow-soft sm:max-w-md">
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-soft text-green">
                <LockKeyhole aria-hidden="true" size={19} />
              </span>
              <button
                aria-label={d.cancel}
                className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-track"
                onClick={() => setOpenedWith(null)}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <h2
              className="font-expressive mt-5 text-3xl font-medium text-ink"
              id="share-title"
            >
              {d.shareConfirmTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {d.shareConfirmBody}
            </p>
            <form action={formAction} className="mt-6 grid gap-3">
              <input name="locale" type="hidden" value={locale} />
              <input name="answerId" type="hidden" value={answerId} />
              <input name="questionId" type="hidden" value={questionId} />
              <input
                name="expectedOptionKey"
                type="hidden"
                value={expectedOptionKey}
              />
              <SubmitButton className="w-full" pendingLabel={d.saving}>
                {d.shareConfirm}
              </SubmitButton>
              <Button
                className="w-full"
                onClick={() => setOpenedWith(null)}
                variant="ghost"
              >
                {d.cancel}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
