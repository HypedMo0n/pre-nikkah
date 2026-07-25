import { notFound } from "next/navigation";

import { LocalePicker } from "@/components/i18n/locale-picker";
import { DeleteAccountSheet } from "@/components/settings/delete-account-sheet";
import { InfoRowSheet } from "@/components/settings/info-row-sheet";
import { PauseResumeForm } from "@/components/settings/pause-resume-form";
import { UnlinkPartnerButton } from "@/components/settings/unlink-partner-button";
import { ListRow } from "@/components/ui/list-row";
import { SubmitButton } from "@/components/ui/submit-button";
import { signOutAction } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

function GroupHeader({ children }: { children: string }) {
  return <p className="mb-2 font-productive text-[11px] font-semibold uppercase tracking-[0.10em] text-muted">{children}</p>;
}

// §7.12. Grouped rows: ACCOUNT, PREFERENCES, YOUR SPACE (only shown once
// a space exists), PRIVACY & DATA, then sign out. Reachable regardless of
// space status — unlike every other private screen, it never redirects
// on 'waiting' or 'paused', since resuming or unlinking both happen here.
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const returnPath = `/${locale}/settings`;
  const { supabase, user } = await requireAuthenticatedUser(locale, returnPath);

  const [{ data: profile }, { data: spaceId }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("current_space_id"),
  ]);

  let spaceStatus: "waiting" | "active" | "paused" | "closed" | null = null;
  let partnerName: string | null = null;
  if (spaceId) {
    const [{ data: space }, { data: partner }] = await Promise.all([
      supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle(),
      supabase.rpc("get_partner_display_name"),
    ]);
    spaceStatus = space?.status ?? null;
    partnerName = partner ?? null;
  }
  const hasPartner = spaceStatus === "active" || spaceStatus === "paused";

  return (
    <main className="mx-auto w-full max-w-md px-7 py-8">
      <h1 className="font-expressive text-3xl font-light text-ink">{d["settings.title"]}</h1>

      <div className="mt-8">
        <GroupHeader>{d["settings.accountGroup"]}</GroupHeader>
        <div className="space-y-2.5">
          <ListRow subtitle={profile?.display_name ?? "—"} title={d["settings.name"]} />
          <ListRow subtitle={user.email ?? "—"} title={d["settings.email"]} />
        </div>
      </div>

      <div className="mt-7">
        <GroupHeader>{d["settings.preferencesGroup"]}</GroupHeader>
        <div className="space-y-2.5">
          <LocalePicker locale={locale} variant="row" />
          <InfoRowSheet title={d["settings.notifications"]}>
            <p className="font-productive text-[14px] leading-6 text-muted">{d["settings.notificationsBody"]}</p>
          </InfoRowSheet>
        </div>
      </div>

      {spaceId ? (
        <div className="mt-7">
          <GroupHeader>{d["settings.yourSpaceGroup"]}</GroupHeader>
          <div className="space-y-2.5">
            <ListRow subtitle={hasPartner ? (partnerName ?? d["topics.partnerFallback"]) : d["settings.notYetPaired"]} title={d["settings.pairedWith"]} />
            {hasPartner ? (
              <>
                <PauseResumeForm locale={locale} paused={spaceStatus === "paused"} returnPath={returnPath} />
                <UnlinkPartnerButton locale={locale} returnPath={returnPath} />
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-7">
        <GroupHeader>{d["settings.privacyGroup"]}</GroupHeader>
        <div className="space-y-2.5">
          <InfoRowSheet title={d["settings.whatPartnerSees"]}>
            <p className="font-productive text-[14px] leading-6 text-muted">{d["settings.whatPartnerSeesBody"]}</p>
          </InfoRowSheet>
          <a
            className="flex w-full items-center justify-between rounded-card border border-hairline bg-white px-4 py-3.5 text-left font-productive text-[15px] font-semibold text-ink"
            download
            href="/api/export-answers"
          >
            {d["settings.exportAnswers"]}
          </a>
          <DeleteAccountSheet locale={locale} />
        </div>
      </div>

      <form action={signOutAction} className="mt-8">
        <input name="locale" type="hidden" value={locale} />
        <SubmitButton className="w-full" pendingLabel={d["common.loading"]} variant="secondary">
          {d["auth.signOut"]}
        </SubmitButton>
      </form>
    </main>
  );
}
