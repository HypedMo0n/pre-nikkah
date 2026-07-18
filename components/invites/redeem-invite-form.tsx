"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { redeemInviteAction } from "@/features/invites/actions";
import { formatInviteCode } from "@/features/invites/invite-code";
import { initialInviteActionState } from "@/features/invites/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function RedeemInviteForm({ inviteCode, locale }: { inviteCode: string; locale: Locale }) {
  const [state, action] = useActionState(redeemInviteAction, initialInviteActionState);
  const d = getDictionary(locale);
  return (
    <form action={action} className="mt-7 space-y-5">
      <input name="locale" type="hidden" value={locale} />
      <input name="inviteCode" type="hidden" value={inviteCode} />
      <p className="break-all rounded-productive border bg-card p-4 text-center font-mono text-base font-semibold tracking-[0.08em] text-ink min-[360px]:text-lg min-[360px]:tracking-widest">
        {formatInviteCode(inviteCode)}
      </p>
      <label className="flex cursor-pointer items-start gap-3 rounded-productive border bg-card p-4 text-sm leading-6 text-ink">
        <input className="mt-0.5 size-5 shrink-0 accent-primary" name="policyAccepted" required type="checkbox" />
        <span>{d["policy.checkbox"]}</span>
      </label>
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>{d["policy.acceptJoin"]}</SubmitButton>
    </form>
  );
}
