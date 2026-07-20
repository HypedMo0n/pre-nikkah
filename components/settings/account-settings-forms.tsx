"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { abandonEmptyWaitingJourneyAction } from "@/features/invites/journey-actions";
import {
  closeJourneyAction,
  updatePrivateDisplayNameAction,
} from "@/features/settings/actions";
import { initialSettingsActionState } from "@/features/settings/types";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function DisplayNameSettingsForm({
  initialValue,
  locale,
}: {
  initialValue: string;
  locale: Locale;
}) {
  const [state, action] = useActionState(
    updatePrivateDisplayNameAction,
    initialSettingsActionState,
  );
  const d = getDictionary(locale);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="locale" type="hidden" value={locale} />
      <label className="block text-sm font-semibold text-ink" htmlFor="settings-display-name">
        {d["auth.displayName"]}
      </label>
      <input
        className="min-h-12 w-full rounded-productive border bg-card px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
        defaultValue={initialValue}
        id="settings-display-name"
        maxLength={60}
        name="privateDisplayName"
        placeholder={d["account.placeholder"]}
      />
      <FormMessage
        message={state.message}
        status={state.status === "saved" ? "success" : state.status}
      />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="secondary">
        {d["settings.saveDisplayName"]}
      </SubmitButton>
    </form>
  );
}

export function CloseJourneyForm({ locale, mode }: { locale: Locale; mode: "active" | "waiting" }) {
  return mode === "waiting"
    ? <AbandonWaitingJourneySettingsForm locale={locale} />
    : <ActiveCloseJourneySettingsForm locale={locale} />;
}

function ActiveCloseJourneySettingsForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(closeJourneyAction, initialSettingsActionState);
  const d = getDictionary(locale);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="locale" type="hidden" value={locale} />
      <label className="block text-sm font-semibold text-ink" htmlFor="close-confirmation">
        {d["settings.typeClose"]}
      </label>
      <input
        autoComplete="off"
        className="min-h-12 w-full rounded-productive border bg-card px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-concern"
        id="close-confirmation"
        name="confirmation"
        required
      />
      <FormMessage
        message={state.message}
        status={state.status === "saved" ? "success" : state.status}
      />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="danger">
        {d["settings.closeAction"]}
      </SubmitButton>
    </form>
  );
}

function AbandonWaitingJourneySettingsForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(abandonEmptyWaitingJourneyAction, { status: "idle" });
  const d = getDictionary(locale);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="locale" type="hidden" value={locale} />
      <p className="text-sm leading-6 text-body">{d["waitingJourney.body"]}</p>
      <FormMessage
        message={state.status === "error" ? state.message : undefined}
        status={state.status === "error" ? "error" : "idle"}
      />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="danger">
        {d["waitingJourney.close"]}
      </SubmitButton>
    </form>
  );
}
