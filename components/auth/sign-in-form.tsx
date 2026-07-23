"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signInAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function SignInForm({ locale, next }: { locale: Locale; next?: string }) {
  const [state, action] = useActionState(signInAction, initialAuthActionState);
  const d = getDictionary(locale);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input name="locale" type="hidden" value={locale} />
      {next ? <input name="next" type="hidden" value={next} /> : null}
      <Field autoComplete="email" label={d["auth.email"]} name="email" required type="email" />
      <Field autoComplete="current-password" label={d["auth.password"]} name="password" required type="password" />
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {d["auth.signInAction"]}
      </SubmitButton>
    </form>
  );
}
