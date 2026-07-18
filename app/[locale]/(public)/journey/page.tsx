import { ArrowRight, Link2, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function JourneyChoicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  const choices = [
    {
      Icon: UserRoundPlus,
      title: d["journey.createTitle"],
      body: d["journey.createBody"],
      href: `${localizedPath(locale, "/sign-up")}?mode=create`,
    },
    {
      Icon: Link2,
      title: d["journey.joinTitle"],
      body: d["journey.joinBody"],
      href: localizedPath(locale, "/join"),
    },
  ];
  return (
    <OnboardingShell backHref={localizedPath(locale, "/privacy")} locale={locale}>
      <h1 className="font-expressive text-4xl font-medium leading-tight text-ink">{d["journey.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["journey.body"]}</p>
      <div className="mt-8 space-y-4">
        {choices.map(({ Icon, title, body, href }) => (
          <Link className="group block focus-visible:outline-none" href={href} key={title}>
            <Card className="flex min-h-32 items-center gap-4 p-5 transition-colors group-hover:border-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-primary">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Icon aria-hidden="true" size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-body">{body}</p>
              </div>
              <ArrowRight aria-hidden="true" className="shrink-0 text-ink-soft" size={19} />
            </Card>
          </Link>
        ))}
      </div>
    </OnboardingShell>
  );
}
