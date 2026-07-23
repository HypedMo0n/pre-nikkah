"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetPasswordAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(resetPasswordAction, initialAuthActionState);
  const d = getDictionary(locale);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input name="locale" type="hidden" value={locale} />
      <Field autoComplete="new-password" label={d["auth.newPassword"]} minLength={8} name="password" required type="password" />
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {d["auth.updatePassword"]}
      </SubmitButton>
    </form>
  );
}
