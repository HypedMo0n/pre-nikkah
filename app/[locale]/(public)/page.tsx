import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { LocalePicker } from "@/components/i18n/locale-picker";
import { buttonClasses } from "@/components/ui/button";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.1. "Begin together" leads into the onboarding sequence (How it
// works → Create your space → Invite your partner); "I have an invite"
// skips straight to redemption, since a partner arriving with a code
// doesn't need the same walkthrough.
export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-7 py-10 text-center">
      <div className="absolute right-4 top-4">
        <LocalePicker locale={locale} />
      </div>
      <BrandMark />
      <h1 className="font-expressive mt-8 max-w-sm text-[40px] font-light leading-[1.08] tracking-[-0.02em] text-ink">
        {d["welcome.headline"]}
      </h1>
      <p className="mt-3 max-w-xs font-productive text-base text-muted">{d["welcome.subhead"]}</p>
      <Link className={buttonClasses({ className: "mt-8 w-full max-w-xs" })} href={localizedPath(locale, "/how-it-works")}>
        {d["welcome.begin"]}
      </Link>
      <Link
        className="mt-4 font-productive text-[14px] text-green underline underline-offset-2"
        href={localizedPath(locale, "/join")}
      >
        {d["welcome.haveInvite"]}
      </Link>
      <p className="mt-10 font-productive text-[12.5px] text-muted">{d["footer.trust"]}</p>
    </main>
  );
}
