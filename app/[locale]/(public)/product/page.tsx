import { ArrowRight, MessagesSquare, ScanSearch, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  const steps = [
    [ShieldCheck, d["product.stepOneTitle"], d["product.stepOneBody"]],
    [ScanSearch, d["product.stepTwoTitle"], d["product.stepTwoBody"]],
    [MessagesSquare, d["product.stepThreeTitle"], d["product.stepThreeBody"]],
  ] as const;

  return (
    <OnboardingShell backHref={localizedPath(locale, "/welcome")} locale={locale}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{d["product.eyebrow"]}</p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">{d["product.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["product.body"]}</p>
      <div className="mt-8 space-y-3">
        {steps.map(([Icon, title, body]) => (
          <Card className="flex gap-4 p-4" key={title}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon aria-hidden="true" size={20} />
            </span>
            <div>
              <h2 className="font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-body">{body}</p>
            </div>
          </Card>
        ))}
      </div>
      <Link className={buttonClasses({ className: "mt-8 w-full" })} href={localizedPath(locale, "/privacy")}>
        {d["common.continue"]}
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </OnboardingShell>
  );
}
