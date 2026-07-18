"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveRelationshipStageAction } from "@/features/onboarding/actions";
import { initialOnboardingActionState } from "@/features/onboarding/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const values = [
  ["getting_to_know_seriously", "stage.serious"],
  ["families_involved", "stage.families"],
  ["engaged", "stage.engaged"],
  ["preparing_for_nikah", "stage.nikah"],
  ["other", "stage.other"],
] as const;

export function StageForm({ entryMode, inviteCode, locale }: { entryMode: "create" | "join"; inviteCode?: string; locale: Locale }) {
  const [state, action] = useActionState(saveRelationshipStageAction, initialOnboardingActionState);
  const [selected, setSelected] = useState<string>();
  const d = getDictionary(locale);
  return (
    <form action={action} className="mt-8 space-y-3">
      <input name="locale" type="hidden" value={locale} />
      <input name="entryMode" type="hidden" value={entryMode} />
      <input name="inviteCode" type="hidden" value={inviteCode ?? ""} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{d["stage.title"]}</legend>
        {values.map(([value, key]) => (
          <label
            className={cn(
              "flex min-h-20 cursor-pointer items-center rounded-expressive border p-4 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary",
              selected === value ? "border-primary bg-primary text-white" : "bg-card text-ink hover:border-primary/30",
            )}
            key={value}
          >
            <input className="sr-only" name="relationshipStage" onChange={() => setSelected(value)} required type="radio" value={value} />
            {d[key]}
          </label>
        ))}
      </fieldset>
      <FormMessage message={state.message} status={state.status} />
      <SubmitButton className="mt-4 w-full" disabled={!selected} pendingLabel={d["common.loading"]}>{d["common.continue"]}</SubmitButton>
    </form>
  );
}
