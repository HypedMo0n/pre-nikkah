"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import {
  initialActionState,
} from "@/features/v3/action-types";
import {
  closeSpaceAction,
  updateProfileAction,
} from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import type { Locale } from "@/lib/i18n/config";

export function ProfileForm({
  displayName,
  locale,
}: {
  displayName: string;
  locale: Locale;
}) {
  const d = getV3Copy(locale);
  const [state, action] = useActionState(
    updateProfileAction,
    initialActionState,
  );
  return (
    <form action={action} className="mt-4 space-y-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="preferredLocale" type="hidden" value={locale} />
      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="display-name">
          {d.displayName}
        </label>
        <input
          className="mt-2 min-h-12 w-full rounded-card border border-hairline bg-white px-4 text-base text-ink outline-none focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/20"
          defaultValue={displayName}
          id="display-name"
          maxLength={80}
          name="displayName"
          required
        />
      </div>
      {state.message ? (
        <p
          className={`text-sm ${state.status === "error" ? "text-danger" : "text-green"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full" pendingLabel={d.saving} variant="secondary">
        {d.save}
      </SubmitButton>
    </form>
  );
}

export function CloseSpaceForm({ locale }: { locale: Locale }) {
  const d = getV3Copy(locale);
  const [state, action] = useActionState(
    closeSpaceAction,
    initialActionState,
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="locale" type="hidden" value={locale} />
      <label className="text-sm font-semibold text-ink" htmlFor="close-space">
        {d.closeConfirm}
      </label>
      <input
        autoComplete="off"
        className="min-h-12 w-full rounded-card border border-danger/40 bg-white px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-danger"
        id="close-space"
        name="confirmation"
        pattern="CLOSE"
        required
      />
      {state.status === "error" ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full" pendingLabel={d.saving} variant="danger">
        {d.unlinkPartner}
      </SubmitButton>
    </form>
  );
}
