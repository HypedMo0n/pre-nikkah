"use client";

import { Check, Copy, RefreshCw, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import QRCode from "react-qr-code";

import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSpaceInviteAction, revokeSpaceInviteAction } from "@/features/spaces/actions";
import { initialSpaceInviteState } from "@/features/spaces/types";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function InviteCreator({
  locale,
  initial,
}: {
  locale: Locale;
  initial: { id: string; code: string; formattedCode: string; expiresAt: string; link: string | null };
}) {
  const [state, createAction] = useActionState(createSpaceInviteAction, {
    status: "created",
    invitation: initial,
  });
  const [revokeState, revokeAction] = useActionState(revokeSpaceInviteAction, initialSpaceInviteState);
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

  async function share(link: string) {
    if (!navigator.share) return copy(link, "link");
    try {
      await navigator.share({ url: link });
    } catch {
      // Cancelling the native share sheet is not an application error.
    }
  }

  if (state.status !== "created" || revokeState.status === "revoked") {
    return (
      <FormMessage message={state.status === "error" ? state.message : undefined} status={state.status === "error" ? "error" : "idle"} />
    );
  }

  const { invitation } = state;

  return (
    <div className="mt-7 space-y-5">
      <Card className="p-5 text-center shadow-soft">
        <p className="font-productive text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          {d["invite.codeLabel"]}
        </p>
        <p className="font-expressive mt-3 flex flex-wrap justify-center gap-x-2 text-3xl font-normal text-ink">
          {invitation.formattedCode}
        </p>
        <p className="mt-3 font-productive text-xs leading-5 text-muted">{d["invite.once"]}</p>
      </Card>

      <figure className="rounded-card border border-hairline bg-white p-5 text-center">
        <div aria-label={d["invite.qrLabel"]} className="mx-auto w-full max-w-[214px] rounded-xl bg-white p-3" role="img">
          <QRCode bgColor="#FFFFFF" fgColor="#23201C" size={190} style={{ height: "auto", width: "100%" }} value={invitation.link ?? invitation.code} />
        </div>
      </figure>

      <Chip variant="neutral">
        <span aria-hidden="true" className="size-1.5 animate-waiting-pulse rounded-full bg-amber" />
        {d["invite.waiting"]}
      </Chip>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={() => copy(invitation.formattedCode, "code")} variant="secondary">
          <Copy aria-hidden="true" size={17} />
          {copied === "code" ? <Check aria-hidden="true" size={17} /> : d["invite.copyCode"]}
        </Button>
        {invitation.link ? (
          <Button className="sm:col-span-2" onClick={() => share(invitation.link as string)}>
            <Share2 aria-hidden="true" size={17} />
            {d["invite.share"]}
          </Button>
        ) : null}
      </div>

      <form action={revokeAction}>
        <input name="locale" type="hidden" value={locale} />
        <input name="inviteId" type="hidden" value={invitation.id} />
        <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="secondary">
          <Trash2 aria-hidden="true" size={17} />
          {d["invite.revoke"]}
        </SubmitButton>
      </form>

      <form action={createAction}>
        <input name="locale" type="hidden" value={locale} />
        <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="secondary">
          <RefreshCw aria-hidden="true" size={17} />
          {d["invite.regenerate"]}
        </SubmitButton>
      </form>

      <div className="rounded-card border border-hairline bg-white p-4 text-center">
        <p className="font-productive text-[15px] font-semibold text-ink">{d["invite.solo"]}</p>
        <p className="mt-1 font-productive text-[13px] leading-6 text-muted">{d["invite.soloBody"]}</p>
        <Link className={buttonClasses({ className: "mt-4 w-full" })} href={localizedPath(locale, "/home")}>
          {d["invite.solo"]}
        </Link>
      </div>
    </div>
  );
}
