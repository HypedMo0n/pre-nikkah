import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { LanguageSheet } from "@/components/v3/language-sheet";
import { getV3Copy } from "@/features/v3/copy";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getV3Copy(locale);

  return (
    <main className="min-h-screen">
      <LanguageSheet d={d} locale={locale} />
      <Container className="grid min-h-screen max-w-6xl items-center gap-10 py-10 md:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)] md:py-20 lg:gap-16">
        <section
          aria-labelledby="welcome-title"
          className="mx-auto w-full max-w-2xl text-center md:mx-0 md:text-left"
        >
          <BrandLockup />
          <p className="mt-12 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
            {d.welcomeEyebrow}
          </p>
          <h1
            className="font-expressive mt-3 text-balance text-5xl font-medium leading-[1.02] tracking-[-0.035em] text-ink sm:text-6xl"
            id="welcome-title"
          >
            {d.welcomeTitle}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            {d.welcomeBody}
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
            <Link
              className={buttonClasses({ className: "sm:min-w-64" })}
              href={localizedPath(locale, "/product")}
            >
              {d.welcomePrimary}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              className={buttonClasses({
                className: "sm:min-w-56",
                variant: "secondary",
              })}
              href={localizedPath(locale, "/join")}
            >
              {d.welcomeSecondary}
            </Link>
          </div>
          <p className="mt-6 text-xs font-medium text-muted">{d.welcomeFooter}</p>
          <p className="mt-8 max-w-xl text-xs leading-5 text-muted">{d.notAdvice}</p>
        </section>

        <Card className="relative mx-auto w-full max-w-md overflow-hidden border-green bg-green p-7 text-left text-white md:max-w-none sm:p-9">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
            <LockKeyhole aria-hidden="true" size={22} />
          </div>
          <h2 className="font-expressive mt-8 text-3xl font-medium">
            {d.privacyPromise}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/80">
            {d.privacyDetail}
          </p>
          <div className="my-7 h-px bg-white/20" />
          <p className="flex items-start gap-3 text-sm leading-6 text-white/70">
            <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
            {d.publicTrust}
          </p>
        </Card>
      </Container>
    </main>
  );
}
