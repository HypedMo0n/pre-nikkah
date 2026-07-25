"use client";

import { useActionState } from "react";

import { TextAreaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { addSharedNoteAction } from "@/features/discuss/actions";
import { initialDiscussActionState } from "@/features/discuss/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function AddNoteForm({
  locale,
  questionId,
  returnPath,
}: {
  locale: Locale;
  questionId: string;
  returnPath: string;
}) {
  const [state, action] = useActionState(addSharedNoteAction, initialDiscussActionState);
  const d = getDictionary(locale);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input name="locale" type="hidden" value={locale} />
      <input name="questionId" type="hidden" value={questionId} />
      <input name="returnPath" type="hidden" value={returnPath} />
      <TextAreaField maxLength={2000} name="body" placeholder={d["discuss.notePlaceholder"]} required />
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <SubmitButton pendingLabel={d["common.loading"]} variant="secondary">
        {d["discuss.addNote"]}
      </SubmitButton>
    </form>
  );
}
