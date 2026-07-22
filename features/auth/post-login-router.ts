import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getInviteIntent, inviteIntentPath } from "@/lib/auth/invite-intent";
import { safeReturnPath } from "@/lib/auth/paths";
import type { Locale } from "@/lib/i18n/config";
import type { Database } from "@/types/database";

export async function getPostLoginRoute(
  locale: Locale,
  _supabase: SupabaseClient<Database>,
  requestedNext?: FormDataEntryValue | string | null,
) {
  const safeNext = safeReturnPath(locale, requestedNext);
  const intent = await getInviteIntent();
  const intentRoute = inviteIntentPath(locale, intent);
  if (intentRoute) return intentRoute;

  return safeNext;
}
