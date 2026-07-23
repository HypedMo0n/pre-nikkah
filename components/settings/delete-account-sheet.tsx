"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteOwnAccountAction } from "@/features/account-deletion/actions";
import { initialDeleteAccountState } from "@/features/account-deletion/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.12: irreversible, so it requires re-authentication (password) plus a
// typed "DELETE" confirmation, not just a confirmation sheet — the
// heaviest of the three destructive actions in the product.
export function DeleteAccountSheet({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteOwnAccountAction, initialDeleteAccountState);
  const d = getDictionary(locale);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "deleted") {
      router.push(state.redirectTo);
    }
  }, [router, state]);

  return (
    <>
      <button
        className="flex w-full items-center justify-between rounded-card border border-hairline bg-white px-4 py-3.5 text-left font-productive text-[15px] font-semibold text-danger"
        onClick={() => setOpen(true)}
        type="button"
      >
        {d["settings.deleteData"]}
      </button>
      <Sheet onClose={() => setOpen(false)} open={open} title={d["settings.deleteConfirmTitle"]}>
        <p className="font-productive text-[14px] leading-6 text-muted">{d["settings.deleteConfirmBody"]}</p>
        <form action={action} className="mt-5 space-y-3">
          <input name="locale" type="hidden" value={locale} />
          <Field
            autoComplete="off"
            label={d["settings.deleteConfirmLabel"]}
            name="confirmation"
            placeholder="DELETE"
            required
          />
          <Field autoComplete="current-password" label={d["auth.password"]} name="password" required type="password" />
          <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
          <SubmitButton className="w-full bg-danger" pendingLabel={d["common.loading"]}>
            {d["settings.deleteConfirmAction"]}
          </SubmitButton>
          <button className={buttonClasses({ className: "w-full", variant: "secondary" })} onClick={() => setOpen(false)} type="button">
            {d["common.cancel"]}
          </button>
        </form>
      </Sheet>
    </>
  );
}
