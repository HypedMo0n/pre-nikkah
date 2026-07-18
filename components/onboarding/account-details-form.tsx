"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveAccountDetailsAction } from "@/features/onboarding/actions";
import { initialOnboardingActionState } from "@/features/onboarding/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function AccountDetailsForm({ entryMode, inviteCode, locale }: { entryMode: "create" | "join"; inviteCode?: string; locale: Locale }) {
  const [state, action] = useActionState(saveAccountDetailsAction, initialOnboardingActionState);
  const [neutral, setNeutral] = useState(false);
  const d = getDictionary(locale);
  return (
    <form action={action} className="mt-8 space-y-5">
      <input name="locale" type="hidden" value={locale} />
      <input name="entryMode" type="hidden" value={entryMode} />
      <input name="inviteCode" type="hidden" value={inviteCode ?? ""} />
      <div>
        <label className="mb-2 block text-sm font-semibold text-ink" htmlFor="private-display-name">{d["auth.displayName"]}</label>
        <input
          aria-describedby="display-name-help"
          className="min-h-12 w-full rounded-productive border bg-card px-4 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:bg-section"
          disabled={neutral}
          id="private-display-name"
          maxLength={80}
          name="privateDisplayName"
          placeholder={d["account.placeholder"]}
          type="text"
        />
        <p className="mt-2 text-xs leading-5 text-ink-soft" id="display-name-help">{d["auth.displayNameHint"]}</p>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-productive border bg-card px-4 py-3 text-sm text-ink">
        <input checked={neutral} className="size-5 accent-primary" onChange={(event) => setNeutral(event.target.checked)} type="checkbox" />
        {d["account.keepNeutral"]}
      </label>
      <FormMessage message={state.message} status={state.status} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>{d["account.save"]}</SubmitButton>
    </form>
  );
}
