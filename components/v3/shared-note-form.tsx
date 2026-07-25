"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import {
  initialActionState,
} from "@/features/v3/action-types";
import { saveSharedNoteAction } from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import type { Locale } from "@/lib/i18n/config";

export function SharedNoteForm({
  locale,
  questionId,
  spaceId,
}: {
  locale: Locale;
  questionId: string;
  spaceId: string;
}) {
  const d = getV3Copy(locale);
  const [state, action] = useActionState(
    saveSharedNoteAction,
    initialActionState,
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="locale" type="hidden" value={locale} />
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="questionId" type="hidden" value={questionId} />
      <label className="sr-only" htmlFor="shared-note-body">
        {d.sharedNotes}
      </label>
      <textarea
        className="min-h-28 w-full resize-y rounded-card border border-hairline bg-white p-4 text-base text-ink outline-none focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/20"
        id="shared-note-body"
        maxLength={5000}
        name="body"
        placeholder={d.sharedNotePlaceholder}
        required
      />
      {state.message ? (
        <p
          className={`text-sm ${state.status === "error" ? "text-danger" : "text-green"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton
        className="w-full"
        pendingLabel={d.saving}
        variant="secondary"
      >
        {d.addNote}
      </SubmitButton>
    </form>
  );
}
