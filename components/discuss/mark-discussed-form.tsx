"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { markDiscussedAction } from "@/features/discuss/actions";
import { initialDiscussActionState } from "@/features/discuss/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function MarkDiscussedForm({
  locale,
  questionId,
  returnPath,
  discussed,
}: {
  locale: Locale;
  questionId: string;
  returnPath: string;
  discussed: boolean;
}) {
  const [state, action] = useActionState(markDiscussedAction, initialDiscussActionState);
  const d = getDictionary(locale);

  if (discussed) {
    return <p className="font-productive text-[13px] font-semibold text-green">{d["discuss.discussed"]}</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input name="locale" type="hidden" value={locale} />
      <input name="questionId" type="hidden" value={questionId} />
      <input name="returnPath" type="hidden" value={returnPath} />
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {d["discuss.markDiscussed"]}
      </SubmitButton>
    </form>
  );
}
