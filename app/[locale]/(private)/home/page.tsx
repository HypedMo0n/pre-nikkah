import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/ui/submit-button";
import { signOutAction } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Minimal placeholder proving the auth + space-pairing flow lands
// somewhere real. Task #12 (Home screen assembly) replaces this with the
// full §7.5 screen (The Path, continue card, topic list).
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const { supabase } = await requireAuthenticatedUser(locale);

  const { data: spaceId } = await supabase.rpc("current_space_id");
  const { data: space } = spaceId
    ? await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto w-full max-w-md px-7 py-10">
      <h1 className="font-expressive text-3xl font-light text-ink">Home</h1>
      <p className="mt-2 font-productive text-[15px] text-muted">
        Space status: {space?.status ?? "none"}
      </p>
      <form action={signOutAction} className="mt-8">
        <input name="locale" type="hidden" value={locale} />
        <SubmitButton pendingLabel={d["common.loading"]} variant="secondary">
          Sign out
        </SubmitButton>
      </form>
    </main>
  );
}
