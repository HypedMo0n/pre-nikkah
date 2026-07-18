"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { signInAction, signUpAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/validation";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const inputClasses =
  "min-h-12 w-full rounded-productive border bg-card px-4 text-base text-ink outline-none placeholder:text-ink-soft focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export function AuthForm({
  entryMode = "create",
  locale,
  mode,
  next,
}: {
  entryMode?: "create" | "join";
  locale: Locale;
  mode: "sign-in" | "sign-up";
  next: string;
}) {
  const action = mode === "sign-up" ? signUpAction : signInAction;
  const [state, formAction] = useActionState(action, initialAuthActionState);
  const [showPassword, setShowPassword] = useState(false);
  const d = getDictionary(locale);
  const errorId = `${mode}-form-error`;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input name="locale" type="hidden" value={locale} />
      <input name="entryMode" type="hidden" value={entryMode} />
      <input name="next" type="hidden" value={next} />

      <div>
        <label className="mb-2 block text-sm font-semibold text-ink" htmlFor={`${mode}-email`}>
          {d["auth.email"]}
        </label>
        <input
          aria-describedby={state.fieldErrors?.email ? `${mode}-email-error` : undefined}
          autoComplete="email"
          className={inputClasses}
          id={`${mode}-email`}
          inputMode="email"
          maxLength={320}
          name="email"
          required
          type="email"
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-concern" id={`${mode}-email-error`}>
            {d["auth.genericError"]}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-ink" htmlFor={`${mode}-password`}>
          {d["auth.password"]}
        </label>
        <div className="relative">
          <input
            aria-describedby={state.fieldErrors?.password ? `${mode}-password-error` : undefined}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className={`${inputClasses} pe-12`}
            id={`${mode}-password`}
            maxLength={128}
            minLength={8}
            name="password"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 end-0 flex min-w-11 items-center justify-center rounded-e-productive text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-concern" id={`${mode}-password-error`}>
            {d["auth.genericError"]}
          </p>
        )}
      </div>

      {mode === "sign-up" && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <label className="text-sm font-semibold text-ink" htmlFor="private-display-name">
              {d["auth.displayName"]}
            </label>
            <span className="text-xs text-ink-soft">{d["common.optional"]}</span>
          </div>
          <input
            aria-describedby="private-display-name-hint"
            autoComplete="nickname"
            className={inputClasses}
            id="private-display-name"
            maxLength={80}
            name="privateDisplayName"
            type="text"
          />
          <p className="mt-2 text-xs leading-5 text-ink-soft" id="private-display-name-hint">
            {d["auth.displayNameHint"]}
          </p>
        </div>
      )}

      <FormMessage message={state.message} status={state.status} />

      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {mode === "sign-up" ? d["auth.createAction"] : d["auth.signInAction"]}
      </SubmitButton>

      {mode === "sign-in" && (
        <Link
          className="block min-h-11 py-3 text-center text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={localizedPath(locale, "/forgot-password")}
        >
          {d["auth.forgot"]}
        </Link>
      )}

      <p className="text-center text-sm text-body">
        {mode === "sign-up" ? d["auth.hasAccount"] : d["auth.needsAccount"]}{" "}
        <Link
          className="font-semibold text-primary underline decoration-primary/30 underline-offset-4"
          href={
            mode === "sign-up"
              ? `${localizedPath(locale, "/sign-in")}?mode=${entryMode}&next=${encodeURIComponent(next)}`
              : `${localizedPath(locale, "/sign-up")}?mode=${entryMode}&next=${encodeURIComponent(next)}`
          }
        >
          {mode === "sign-up" ? d["common.signIn"] : d["auth.createAction"]}
        </Link>
      </p>
      <div aria-live="polite" className="sr-only" id={errorId} />
    </form>
  );
}
