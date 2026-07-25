import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { HowItWorksDemo } from "@/components/v3/how-it-works-demo";
import { getV3Copy } from "@/features/v3/copy";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getV3Copy(locale);

  return (
    <OnboardingShell backHref={localizedPath(locale, "/welcome")} locale={locale}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green">
        {d.howEyebrow}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">
        {d.howTitle}
      </h1>
      <HowItWorksDemo d={d} />
      <p className="mt-5 text-sm leading-6 text-muted">{d.demoCaption}</p>
      <div className="mt-6 flex flex-wrap gap-x-3 gap-y-2">
        {d.demoTopics.map((topic) => (
          <span className="text-[0.6875rem] font-medium text-muted" key={topic}>
            {topic}
          </span>
        ))}
      </div>
      <Link
        className={buttonClasses({ className: "mt-8 w-full" })}
        href={`${localizedPath(locale, "/sign-up")}?mode=create&next=${encodeURIComponent(localizedPath(locale, "/invite"))}`}
      >
        {d.continueSetup}
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </OnboardingShell>
  );
}
