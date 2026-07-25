"use client";

import { useActionState, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { shareAnswerAction } from "@/features/discuss/actions";
import { initialDiscussActionState } from "@/features/discuss/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.9: irreversible, so it goes through the same confirmation-sheet
// pattern as any other one-way action in the product — never a plain
// click-to-share button.
export function ShareAnswerButton({
  locale,
  questionId,
  returnPath,
  partnerName,
  alreadyShared,
}: {
  locale: Locale;
  questionId: string;
  returnPath: string;
  partnerName: string | null;
  alreadyShared: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(shareAnswerAction, initialDiscussActionState);
  const d = getDictionary(locale);

  if (alreadyShared) {
    return (
      <p className="font-productive text-[13px] text-muted">
        {partnerName ? d["discuss.alreadyShared"].replace("{partner}", partnerName) : d["discuss.alreadySharedFallback"]}
      </p>
    );
  }

  return (
    <>
      <button
        className={buttonClasses({ className: "w-full", variant: "secondary" })}
        onClick={() => setOpen(true)}
        type="button"
      >
        {partnerName ? d["discuss.shareAction"].replace("{partner}", partnerName) : d["discuss.shareActionFallback"]}
      </button>
      <Sheet onClose={() => setOpen(false)} open={open} title={d["discuss.shareConfirmTitle"]}>
        <p className="font-productive text-[14px] leading-6 text-muted">{d["discuss.shareConfirmBody"]}</p>
        <form action={action} className="mt-5 space-y-3">
          <input name="locale" type="hidden" value={locale} />
          <input name="questionId" type="hidden" value={questionId} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
          <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
            {d["discuss.shareConfirmAction"]}
          </SubmitButton>
          <button className={buttonClasses({ className: "w-full", variant: "secondary" })} onClick={() => setOpen(false)} type="button">
            {d["common.cancel"]}
          </button>
        </form>
      </Sheet>
    </>
  );
}
