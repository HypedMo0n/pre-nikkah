import { notFound, redirect } from "next/navigation";

import { RedeemInviteForm } from "@/components/invites/redeem-invite-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { normalizeInviteCode } from "@/features/invites/invite-code";
import { inspectSpaceInvite } from "@/features/spaces/server";
import { getAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function JoinInviteCodePage({
  params,
}: {
  params: Promise<{ locale: string; inviteCode: string }>;
}) {
  const { locale: rawLocale, inviteCode: rawCode } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const code = normalizeInviteCode(rawCode);
  const d = getDictionary(locale);

  const authenticated = await getAuthenticatedUser();

  if (!authenticated) {
    // A Server Component page cannot set cookies during render; the
    // invite-intent cookie is set by this API route, which then redirects
    // back into the account-creation screen with the intent already saved.
    const destination = localizedPath(locale, "/create-space");
    redirect(
      `/api/invite-intent?code=${encodeURIComponent(code)}&locale=${locale}&destination=${encodeURIComponent(destination)}`,
    );
  }

  const inspection = await inspectSpaceInvite(code);

  return (
    <main>
      <Container className="flex min-h-screen items-center py-10">
        <Card className="w-full p-6 text-center shadow-soft sm:p-8">
          <h1 className="font-expressive text-3xl font-light text-ink">{d["join.title"]}</h1>
          {inspection.status === "available" ? (
            <>
              <p className="mt-2 font-productive text-[15px] text-muted">{d["join.body"]}</p>
              <RedeemInviteForm code={code} locale={locale} />
            </>
          ) : (
            <p className="mt-3 font-productive text-[15px] leading-6 text-danger">
              {inspection.status === "self_invite"
                ? d["join.selfInvite"]
                : inspection.status === "active_space_conflict"
                  ? d["invite.activeSpaceConflict"]
                  : d["join.unavailable"]}
            </p>
          )}
        </Card>
      </Container>
    </main>
  );
}
