"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { forgotPasswordAction, resetPasswordAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/validation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const inputClasses =
  "min-h-12 w-full rounded-productive border bg-card px-4 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export function PasswordForm({ locale, mode }: { locale: Locale; mode: "forgot" | "reset" }) {
  const [state, action] = useActionState(
    mode === "forgot" ? forgotPasswordAction : resetPasswordAction,
    initialAuthActionState,
  );
  const d = getDictionary(locale);
  const label = mode === "forgot" ? d["auth.email"] : d["auth.newPassword"];
  return (
    <form action={action} className="space-y-5">
      <input name="locale" type="hidden" value={locale} />
      <div>
        <label className="mb-2 block text-sm font-semibold text-ink" htmlFor={`${mode}-value`}>
          {label}
        </label>
        <input
          autoComplete={mode === "forgot" ? "email" : "new-password"}
          className={inputClasses}
          id={`${mode}-value`}
          maxLength={mode === "forgot" ? 320 : 128}
          minLength={mode === "reset" ? 8 : undefined}
          name={mode === "forgot" ? "email" : "password"}
          required
          type={mode === "forgot" ? "email" : "password"}
        />
      </div>
      <FormMessage message={state.message} status={state.status} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {mode === "forgot" ? d["auth.sendReset"] : d["auth.updatePassword"]}
      </SubmitButton>
    </form>
  );
}
