"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteOwnAccountAction, initialDeleteAccountState } from "@/features/account-deletion/actions";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function DeleteAccountForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(deleteOwnAccountAction, initialDeleteAccountState);
  const d = getDictionary(locale);
  return <form action={action} className="mt-6 space-y-5"><input name="locale" type="hidden" value={locale} /><div><label className="mb-2 block text-sm font-semibold text-ink" htmlFor="current-password">{d["settings.passwordConfirm"]}</label><input autoComplete="current-password" className="min-h-12 w-full rounded-productive border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" id="current-password" name="password" required type="password" /></div><div><label className="mb-2 block text-sm font-semibold text-ink" htmlFor="delete-confirmation">{d["settings.typeDelete"]}</label><input autoComplete="off" className="min-h-12 w-full rounded-productive border bg-card px-4 font-mono text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" id="delete-confirmation" name="confirmation" pattern="DELETE" required type="text" /></div><FormMessage message={state.message} status={state.status} /><SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="danger"><Trash2 aria-hidden="true" size={18} />{d["settings.deleteAction"]}</SubmitButton></form>;
}
