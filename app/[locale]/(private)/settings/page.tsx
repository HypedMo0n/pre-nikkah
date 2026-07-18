import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  return <OnboardingShell backHref={localizedPath(locale, "/dashboard")} locale={locale} productive><h1 className="text-3xl font-semibold text-ink">{d["settings.title"]}</h1><div className="mt-6 grid gap-3"><Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/summary")}>{d["settings.export"]}</Link><Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/test-complete")}>{d["settings.controlledTest"]}</Link><Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/forgot-password")}>{d["auth.forgotTitle"]}</Link><Link className={buttonClasses({ variant: "secondary", className: "w-full" })} href={localizedPath(locale, "/privacy")}>{d["privacy.title"]}</Link><form action={signOutAction}><input name="locale" type="hidden" value={locale} /><button className={buttonClasses({ variant: "ghost", className: "w-full" })} type="submit">{d["common.signOut"]}</button></form></div><Card className="mt-8 border-concern/30 p-5"><h2 className="text-xl font-semibold text-concern">{d["settings.deleteTitle"]}</h2><p className="mt-3 text-sm font-semibold leading-6 text-ink">{d["settings.deleteBody"]}</p><p className="mt-3 text-xs leading-5 text-ink-soft">{d["settings.deleteBackup"]}</p><DeleteAccountForm locale={locale} /></Card></OnboardingShell>;
}
