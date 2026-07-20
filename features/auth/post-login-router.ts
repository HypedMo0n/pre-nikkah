import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getInviteIntent, inviteIntentPath } from "@/lib/auth/invite-intent";
import { safeReturnPath } from "@/lib/auth/paths";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import type { Database } from "@/types/database";

export type ConnectionStatus = "not_connected" | "waiting" | "active" | "closed";

export async function getPostLoginRoute(
  locale: Locale,
  supabase: SupabaseClient<Database>,
  requestedNext?: FormDataEntryValue | string | null,
) {
  const safeNext = safeReturnPath(locale, requestedNext);
  const intent = await getInviteIntent();
  const intentRoute = inviteIntentPath(locale, intent);
  if (intentRoute) return intentRoute;

  const { data } = await supabase.rpc("get_connection_overview");
  const status = data && typeof data === "object" && "status" in data ? data.status : null;
  if (status === "waiting") return localizedPath(locale, "/onboarding/waiting-journey");
  return safeNext;
}
