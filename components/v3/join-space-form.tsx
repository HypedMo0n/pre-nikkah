"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import {
  initialActionState,
} from "@/features/v3/action-types";
import { redeemInviteAction } from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import {
  formatInviteCode,
  normalizeInviteCode,
} from "@/features/invites/invite-code";
import type { Locale } from "@/lib/i18n/config";

export function JoinSpaceForm({
  initialCode = "",
  locale,
}: {
  initialCode?: string;
  locale: Locale;
}) {
  const d = getV3Copy(locale);
  const [state, action] = useActionState(
    redeemInviteAction,
    initialActionState,
  );
  const [code, setCode] = useState(normalizeInviteCode(initialCode));

  return (
    <form action={action} className="mt-7 space-y-5">
      <input name="locale" type="hidden" value={locale} />
      <label className="block text-sm font-semibold text-ink" htmlFor="invite-code">
        {d.inviteCode}
      </label>
      <input
        autoCapitalize="characters"
        autoComplete="one-time-code"
        className="min-h-14 w-full rounded-card border border-hairline bg-white px-4 text-center font-mono text-lg font-semibold tracking-[0.1em] text-ink outline-none focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/20"
        id="invite-code"
        inputMode="text"
        name="inviteCode"
        onChange={(event) =>
          setCode(normalizeInviteCode(event.target.value))
        }
        placeholder="0000 0000 0000 0000 0000"
        required
        value={formatInviteCode(code)}
      />
      <label className="flex cursor-pointer items-start gap-3 rounded-card border border-hairline bg-white p-4 text-sm leading-6 text-ink">
        <input
          className="mt-0.5 size-5 shrink-0 accent-green"
          name="privacyAccepted"
          required
          type="checkbox"
        />
        <span>{d.inviteAgreement}</span>
      </label>
      {state.status === "error" ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full" pendingLabel={d.saving}>
        {d.joinAction}
      </SubmitButton>
    </form>
  );
}
