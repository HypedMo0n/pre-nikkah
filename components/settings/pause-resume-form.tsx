"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormMessage } from "@/components/ui/form-message";
import { pauseSpaceAction, resumeSpaceAction } from "@/features/settings/actions";
import { initialSettingsActionState } from "@/features/settings/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

function RowSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="flex w-full items-center justify-between rounded-card border border-hairline bg-white px-4 py-3.5 text-left font-productive text-[15px] font-semibold text-ink disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

// §7.12's YOUR SPACE group toggles between the two labels depending on
// the space's current status — never both actions shown at once.
export function PauseResumeForm({ locale, returnPath, paused }: { locale: Locale; returnPath: string; paused: boolean }) {
  const [state, action] = useActionState(paused ? resumeSpaceAction : pauseSpaceAction, initialSettingsActionState);
  const d = getDictionary(locale);

  return (
    <form action={action}>
      <input name="locale" type="hidden" value={locale} />
      <input name="returnPath" type="hidden" value={returnPath} />
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <RowSubmitButton label={paused ? d["settings.resumeSpace"] : d["settings.pauseSpace"]} pendingLabel={d["common.loading"]} />
    </form>
  );
}
