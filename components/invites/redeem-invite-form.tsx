"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { redeemSpaceInviteAction } from "@/features/spaces/actions";
import { initialRedeemInviteState } from "@/features/spaces/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function RedeemInviteForm({ locale, code }: { locale: Locale; code: string }) {
  const [state, action] = useActionState(redeemSpaceInviteAction, initialRedeemInviteState);
  const d = getDictionary(locale);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="inviteCode" type="hidden" value={code} />
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {d["join.action"]}
      </SubmitButton>
    </form>
  );
}
