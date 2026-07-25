import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Destination of deleteOwnAccountAction (§7.12's "Delete my data"). Public:
// by the time a visitor lands here, prepare_account_deletion() and the
// auth user itself are already gone, so there is no session to check.
export default async function AccountDeletedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-7 py-10 text-center">
      <h1 className="font-expressive text-3xl font-light text-ink">{d["accountDeleted.title"]}</h1>
      <p className="mt-3 font-productive text-[15px] leading-6 text-muted">{d["accountDeleted.body"]}</p>
      <Link className={buttonClasses({ className: "mt-8 w-full max-w-xs" })} href={localizedPath(locale, "/")}>
        {d["accountDeleted.returnHome"]}
      </Link>
    </main>
  );
}
