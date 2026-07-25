"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { forgotPasswordAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(forgotPasswordAction, initialAuthActionState);
  const d = getDictionary(locale);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input name="locale" type="hidden" value={locale} />
      <Field autoComplete="email" label={d["auth.email"]} name="email" required type="email" />
      <FormMessage
        message={state.status !== "idle" ? state.message : undefined}
        status={state.status === "idle" ? "idle" : state.status}
      />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {d["auth.sendReset"]}
      </SubmitButton>
    </form>
  );
}
