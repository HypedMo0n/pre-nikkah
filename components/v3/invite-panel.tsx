"use client";

import { Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";
import { useActionState, useState } from "react";
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  initialInviteState,
} from "@/features/v3/action-types";
import { createOrRegenerateInviteAction } from "@/features/v3/actions";
import { getV3Copy } from "@/features/v3/copy";
import type { Locale } from "@/lib/i18n/config";

export function InvitePanel({ locale }: { locale: Locale }) {
  const d = getV3Copy(locale);
  const [state, action] = useActionState(
    createOrRegenerateInviteAction,
    initialInviteState,
  );
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(value: string, type: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
    } catch {
      setCopied(null);
    }
  }

  async function share(link: string, code: string) {
    if (!navigator.share) return copy(link, "link");
    try {
      await navigator.share({ text: `${d.inviteBody} ${code}`, url: link });
    } catch {
      // Closing the platform share sheet is not an error.
    }
  }

  if (state.status === "created") {
    return (
      <div className="mt-7 space-y-5">
        <div className="rounded-card border border-hairline bg-white p-6 text-center">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
            {d.inviteCode}
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tracking-[0.12em] text-ink sm:text-2xl">
            {state.invitation.formattedCode}
          </p>
          <p className="mt-3 text-xs text-muted">
            {d.expires}{" "}
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(state.invitation.expiresAt))}
          </p>
        </div>

        <figure className="rounded-card border border-hairline bg-white p-5 text-center">
          <div
            aria-label={d.inviteCode}
            className="mx-auto w-full max-w-[220px] bg-white p-3"
            role="img"
          >
            <QRCode
              bgColor="#FFFFFF"
              fgColor="#34594A"
              size={196}
              style={{ height: "auto", width: "100%" }}
              value={state.invitation.link}
            />
          </div>
        </figure>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            onClick={() =>
              copy(state.invitation.formattedCode, "code")
            }
            variant="secondary"
          >
            {copied === "code" ? (
              <Check aria-hidden="true" size={17} />
            ) : (
              <Copy aria-hidden="true" size={17} />
            )}
            {copied === "code" ? d.copied : d.copyCode}
          </Button>
          <Button
            onClick={() => copy(state.invitation.link, "link")}
            variant="secondary"
          >
            {copied === "link" ? (
              <Check aria-hidden="true" size={17} />
            ) : (
              <Link2 aria-hidden="true" size={17} />
            )}
            {copied === "link" ? d.copied : d.copyLink}
          </Button>
          <Button
            className="sm:col-span-2"
            onClick={() =>
              share(state.invitation.link, state.invitation.formattedCode)
            }
            variant="secondary"
          >
            <Share2 aria-hidden="true" size={17} />
            {d.shareInvite}
          </Button>
        </div>

        <form action={action}>
          <input name="locale" type="hidden" value={locale} />
          <input name="privacyAccepted" type="hidden" value="on" />
          <SubmitButton
            className="w-full"
            pendingLabel={d.saving}
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" size={17} />
            {d.regenerate}
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="mt-7 space-y-5">
      <input name="locale" type="hidden" value={locale} />
      <label className="flex cursor-pointer items-start gap-3 rounded-card border border-hairline bg-white p-4 text-sm leading-6 text-ink">
        <input
          className="mt-0.5 size-5 shrink-0 accent-green"
          name="privacyAccepted"
          required
          type="checkbox"
        />
        <span>{d.inviteAgreement}</span>
      </label>
      {state.status === "error" ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full" pendingLabel={d.saving}>
        {d.createSpace}
      </SubmitButton>
    </form>
  );
}
