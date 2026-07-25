"use client";

import { useActionState, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { unlinkPartnerAction } from "@/features/settings/actions";
import { initialSettingsActionState } from "@/features/settings/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.12: destructive, so it goes through the same confirmation-sheet
// pattern as sharing an answer — unlink_partner() closes the space.
export function UnlinkPartnerButton({ locale, returnPath }: { locale: Locale; returnPath: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(unlinkPartnerAction, initialSettingsActionState);
  const d = getDictionary(locale);

  return (
    <>
      <button
        className="flex w-full items-center justify-between rounded-card border border-hairline bg-white px-4 py-3.5 text-left font-productive text-[15px] font-semibold text-danger"
        onClick={() => setOpen(true)}
        type="button"
      >
        {d["settings.unlinkPartner"]}
      </button>
      <Sheet onClose={() => setOpen(false)} open={open} title={d["settings.unlinkConfirmTitle"]}>
        <p className="font-productive text-[14px] leading-6 text-muted">{d["settings.unlinkConfirmBody"]}</p>
        <form action={action} className="mt-5 space-y-3">
          <input name="locale" type="hidden" value={locale} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
          <SubmitButton className="w-full bg-danger" pendingLabel={d["common.loading"]}>
            {d["settings.unlinkConfirmAction"]}
          </SubmitButton>
          <button className={buttonClasses({ className: "w-full", variant: "secondary" })} onClick={() => setOpen(false)} type="button">
            {d["common.cancel"]}
          </button>
        </form>
      </Sheet>
    </>
  );
}
