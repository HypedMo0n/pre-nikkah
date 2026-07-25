import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getInviteIntent, inviteIntentPath } from "@/lib/auth/invite-intent";
import { safeReturnPath } from "@/lib/auth/paths";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import type { Database } from "@/types/database";

export async function getPostLoginRoute(
  locale: Locale,
  supabase: SupabaseClient<Database>,
  requestedNext?: FormDataEntryValue | string | null,
) {
  const intent = await getInviteIntent();
  const intentRoute = inviteIntentPath(locale, intent);
  if (intentRoute) return intentRoute;

  const { data: spaceId } = await supabase.rpc("current_space_id");
  if (!spaceId) {
    return localizedPath(locale, "/create-space");
  }

  const { data: space } = await supabase.from("spaces").select("status").eq("id", spaceId).maybeSingle();
  if (space?.status === "waiting") {
    return localizedPath(locale, "/invite");
  }

  return safeReturnPath(locale, requestedNext, localizedPath(locale, "/home"));
}
