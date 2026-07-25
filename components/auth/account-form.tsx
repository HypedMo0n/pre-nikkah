"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUpAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.3's fields (first name, email, password) double as this app's only
// account-creation form — there is no separate generic sign-up screen.
// entryMode only decides signUpAction's fallback redirect; the invite
// intent that actually drives a join is a cookie already set by the
// /join/[code] page before this form ever renders.
export function AccountForm({
  locale,
  entryMode,
  actionLabel,
  next,
}: {
  locale: Locale;
  entryMode: "create" | "join";
  actionLabel: string;
  next?: string;
}) {
  const [state, action] = useActionState(signUpAction, initialAuthActionState);
  const d = getDictionary(locale);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="entryMode" type="hidden" value={entryMode} />
      {next ? <input name="next" type="hidden" value={next} /> : null}
      <Field autoComplete="given-name" label={d["auth.displayName"]} name="displayName" required type="text" />
      <Field autoComplete="email" label={d["auth.email"]} name="email" required type="email" />
      <Field autoComplete="new-password" label={d["auth.password"]} minLength={8} name="password" required type="password" />
      <p className="font-productive text-[12.5px] leading-5 text-muted">{d["createSpace.displayNameHint"]}</p>
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      {state.status === "error" && state.fieldErrors ? (
        <ul className="font-productive text-[12.5px] text-danger">
          {Object.values(state.fieldErrors).flat().map((fieldError) => (
            <li key={fieldError}>{fieldError}</li>
          ))}
        </ul>
      ) : null}
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {actionLabel}
      </SubmitButton>
    </form>
  );
}
