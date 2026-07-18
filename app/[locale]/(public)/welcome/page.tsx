import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  const trustPoints = [
    d["welcome.trustProfile"],
    d["welcome.trustScore"],
    d["welcome.trustAnswers"],
  ];

  return (
    <main>
      <Container className="grid min-h-screen items-center gap-12 py-10 md:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)] md:py-20 lg:gap-20">
        <section aria-labelledby="welcome-heading" className="max-w-2xl">
          <BrandMark className="text-primary" size={42} />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {d["entry.eyebrow"]}
          </p>
          <h1
            className="font-expressive mt-3 text-balance text-4xl font-medium leading-[1.08] text-ink sm:text-5xl lg:text-6xl"
            id="welcome-heading"
          >
            {d["welcome.title"]}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-body sm:text-lg sm:leading-8">
            {d["welcome.body"]}
          </p>

          <ul className="mt-8 space-y-3" role="list">
            {trustPoints.map((point) => (
              <li className="flex items-center gap-3 text-sm text-ink" key={point}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Check aria-hidden="true" size={14} strokeWidth={2.5} />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              className={buttonClasses({ className: "sm:min-w-64" })}
              href={localizedPath(locale, "/product")}
            >
              {d["welcome.primary"]}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              className={buttonClasses({
                className: "sm:min-w-32",
                variant: "secondary",
              })}
              href={localizedPath(locale, "/sign-in")}
            >
              {d["welcome.secondary"]}
            </Link>
          </div>
        </section>

        <Card className="relative overflow-hidden border-ink bg-ink p-6 shadow-soft sm:p-8">
          <div aria-hidden="true" className="absolute -end-16 -top-16 size-44 rounded-full bg-primary/30" />
          <div className="relative">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-accent">
              <LockKeyhole aria-hidden="true" size={23} />
            </span>
            <h2 className="font-expressive mt-6 text-2xl font-medium text-white">
              {d["privacy.title"]}
            </h2>
            <p className="mt-3 leading-7 text-white/85">{d["privacy.beatOne"]}</p>
            <div className="my-6 h-px bg-white/15" />
            <p className="text-sm leading-6 text-white/65">{d["privacy.beatTwo"]}</p>
          </div>
        </Card>
      </Container>
    </main>
  );
}
