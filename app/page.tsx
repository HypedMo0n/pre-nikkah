import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { localeCookieName, parseLocale } from "@/lib/i18n/config";

// Mirrors app/layout.tsx's own locale resolution: the cookie if one is
// already set, defaultLocale otherwise. There is no bare, locale-less
// route anywhere else in the app — every real screen lives under
// /[locale]/... — so this is the one redirect that gets a visitor there.
export default async function RootPage() {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(localeCookieName)?.value);
  redirect(`/${locale}`);
}
