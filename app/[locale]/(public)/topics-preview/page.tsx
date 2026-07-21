import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Static, pre-account preview of the topic library. Deliberately not fetched
// from the database: this route is public (no session yet), and topics are
// only readable by authenticated users per RLS. The names/blurbs here should
// stay in sync with supabase/seed.sql if the canonical topic list changes.
const TOPIC_KEYS = [
  "communication",
  "faith",
  "family",
  "living",
  "household",
  "finances",
  "children",
  "dealbreakers",
] as const;

export default async function TopicsPreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);

  return (
    <OnboardingShell backHref={localizedPath(locale, "/product")} locale={locale}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{d["topicsPreview.eyebrow"]}</p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">{d["topicsPreview.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["topicsPreview.body"]}</p>
      <div className="mt-8 space-y-2.5">
        {TOPIC_KEYS.map((key, index) => (
          <Card className="flex items-start gap-3 p-4" key={key}>
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <div>
              <h2 className="font-semibold text-ink">{d[`topicsPreview.${key}`]}</h2>
              <p className="mt-1 text-sm leading-6 text-body">{d[`topicsPreview.${key}Body`]}</p>
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