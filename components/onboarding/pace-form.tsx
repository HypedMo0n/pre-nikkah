"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { savePacePreferenceAction } from "@/features/onboarding/actions";
import { initialOnboardingActionState } from "@/features/onboarding/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const choices = [
  ["gentle", "pace.gentleTitle", "pace.gentleBody"],
  ["steady", "pace.steadyTitle", "pace.steadyBody"],
  ["flexible", "pace.flexibleTitle", "pace.flexibleBody"],
] as const;

export function PaceForm({
  entryMode,
  inviteCode,
  locale,
}: {
  entryMode: "create" | "join";
  inviteCode?: string;
  locale: Locale;
}) {
  const [state, action] = useActionState(
    savePacePreferenceAction,
    initialOnboardingActionState,
  );
  const [selected, setSelected] = useState("flexible");
  const d = getDictionary(locale);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="entryMode" type="hidden" value={entryMode} />
      <input name="inviteCode" type="hidden" value={inviteCode ?? ""} />
      <fieldset className="space-y-3">
        <legend className="sr-only">{d["pace.title"]}</legend>
        {choices.map(([value, titleKey, bodyKey]) => (
          <label
            className={cn(
              "flex min-h-20 cursor-pointer items-start gap-3 rounded-expressive border p-4 transition-colors focus-within:ring-2 focus-within:ring-ink",
              selected === value
                ? "border-primary bg-primary-soft"
                : "bg-card hover:border-primary/40",
            )}
            key={value}
          >
            <input
              checked={selected === value}
              className="mt-1 size-5 shrink-0 accent-primary"
              name="preferredPace"
              onChange={() => setSelected(value)}
              type="radio"
              value={value}
            />
            <span>
              <span className="block font-semibold text-ink">{d[titleKey]}</span>
              <span className="mt-1 block text-sm leading-6 text-body">{d[bodyKey]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <FormMessage message={state.message} status={state.status} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {d["common.continue"]}
      </SubmitButton>
    </form>
  );
}
