"use client";

import { Check, Copy, Link2, QrCode, RefreshCw, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import QRCode from "react-qr-code";

import { Button, buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { createInviteAction, revokeInviteAction } from "@/features/invites/actions";
import { initialInviteActionState } from "@/features/invites/types";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function InviteCreator({ locale, requirePolicy = true }: { locale: Locale; requirePolicy?: boolean }) {
  const [state, createAction] = useActionState(createInviteAction, initialInviteActionState);
  const [revokeState, revokeAction] = useActionState(revokeInviteAction, initialInviteActionState);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const d = getDictionary(locale);

  async function copy(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }

  async function share(link: string, code: string) {
    if (!navigator.share) return copy(link, "link");
    try {
      await navigator.share({ text: `${d["invite.body"]} ${code}`, url: link });
    } catch {
      // Cancelling the native share sheet is not an application error.
    }
  }

  if (state.status === "created" && revokeState.status !== "revoked") {
    const { invitation } = state;
    return (
      <div className="mt-7 space-y-5">
        <div className="rounded-expressive border bg-card p-5 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">{d["invite.codeLabel"]}</p>
          <p className="mt-3 break-all font-mono text-xl font-semibold tracking-[0.08em] text-ink min-[360px]:text-2xl min-[360px]:tracking-[0.12em]">{invitation.formattedCode}</p>
          <p className="mt-3 text-xs leading-5 text-ink-soft">{d["invite.once"]}</p>
        </div>
        <figure className="rounded-expressive border bg-white p-5 text-center">
          <div aria-label={d["invite.qrLabel"]} className="mx-auto w-full max-w-[214px] rounded-xl bg-white p-3" role="img">
            <QRCode bgColor="#FFFFFF" fgColor="#172342" size={190} style={{ height: "auto", width: "100%" }} value={invitation.link} />
          </div>
          <figcaption className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-soft"><QrCode aria-hidden="true" size={15} />{d["invite.qrLabel"]}</figcaption>
        </figure>
        <p className="text-center text-sm text-body">{d["invite.expires"]} {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expiresAt))}.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={() => copy(invitation.formattedCode, "code")} variant="secondary"><Copy aria-hidden="true" size={17} />{copied === "code" ? <Check aria-hidden="true" size={17} /> : d["invite.copyCode"]}</Button>
          <Button onClick={() => copy(invitation.link, "link")} variant="secondary"><Link2 aria-hidden="true" size={17} />{copied === "link" ? <Check aria-hidden="true" size={17} /> : d["invite.copyLink"]}</Button>
          <Button className="sm:col-span-2" onClick={() => share(invitation.link, invitation.formattedCode)} variant="secondary"><Share2 aria-hidden="true" size={17} />{d["invite.share"]}</Button>
        </div>
        <form action={revokeAction}>
          <input name="locale" type="hidden" value={locale} />
          <input name="inviteId" type="hidden" value={invitation.id} />
          <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="ghost"><Trash2 aria-hidden="true" size={17} />{d["invite.revoke"]}</SubmitButton>
        </form>
        <div className="rounded-productive border bg-section p-4">
          <p className="font-semibold text-ink">{d["invite.solo"]}</p>
          <p className="mt-1 text-sm leading-6 text-body">{d["invite.soloBody"]}</p>
          <Link className={buttonClasses({ className: "mt-4 w-full" })} href={localizedPath(locale, "/dashboard")}>{d["dashboard.begin"]}</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={createAction} className="mt-7 space-y-5">
      <input name="locale" type="hidden" value={locale} />
      {requirePolicy ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-productive border bg-card p-4 text-sm leading-6 text-ink">
          <input className="mt-0.5 size-5 shrink-0 accent-primary" name="policyAccepted" required type="checkbox" />
          <span>{d["policy.checkbox"]}</span>
        </label>
      ) : (
        <input name="policyAccepted" type="hidden" value="on" />
      )}
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
      <SubmitButton className="w-full" pendingLabel={d["common.loading"]}>
        {revokeState.status === "revoked" ? <RefreshCw aria-hidden="true" size={18} /> : null}
        {requirePolicy ? d["policy.acceptCreate"] : d["invite.regenerate"]}
      </SubmitButton>
    </form>
  );
}
