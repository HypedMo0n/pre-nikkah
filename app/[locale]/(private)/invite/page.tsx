import { notFound } from "next/navigation";

import { InviteCreator } from "@/components/invites/invite-creator";
import { formatInviteCode, invitationPath } from "@/features/invites/invite-code";
import { getAuthRedirectOrigin } from "@/lib/auth/origin";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { logServerActionError } from "@/lib/logging/server-action-error";

// §7.4. A fresh code is minted on every load rather than persisted and
// re-shown — space_invites only ever stores a hash, so the plaintext
// cannot be recovered on a later visit even by the server. This matches
// the "shown only after creation, create a new one to share again" copy
// on this screen, not a shortcut around it.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const { supabase, user } = await requireAuthenticatedUser(locale, `/${locale}/invite`);

  const { data, error } = await supabase.rpc("create_space_invite");
  const invitation = data?.[0];
  if (error || !invitation) {
    logServerActionError({ action: "space.invite_page_load", error, userId: user.id });
    return (
      <main>
        <p className="p-7 font-productive text-[15px] text-danger">{d["auth.genericError"]}</p>
      </main>
    );
  }

  const origin = getAuthRedirectOrigin();
  const link = origin ? `${origin}${invitationPath(locale, invitation.invite_code)}` : null;

  return (
    <main className="mx-auto w-full max-w-md px-7 py-10">
      <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.12em] text-green">
        {d["invite.eyebrow"]}
      </p>
      <h1 className="font-expressive mt-2 text-3xl font-light text-ink">{d["invite.title"]}</h1>
      <InviteCreator
        initial={{
          id: invitation.invite_id,
          code: invitation.invite_code,
          formattedCode: formatInviteCode(invitation.invite_code),
          expiresAt: invitation.expires_at,
          link,
        }}
        locale={locale}
      />
    </main>
  );
}
