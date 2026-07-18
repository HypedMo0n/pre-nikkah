import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackLink } from "@/components/feedback/feedback-link";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { validateFeedbackFormUrl } from "@/lib/feedback/form-url";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ControlledTestCompletePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  const feedback = validateFeedbackFormUrl();

  return (
    <OnboardingShell locale={locale}>
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full border border-accent/50 bg-section text-primary">
          <Check aria-hidden="true" size={28} />
        </span>
        <h1 className="font-expressive mt-6 text-balance text-4xl font-medium leading-tight text-ink">
          {d["controlled.title"]}
        </h1>
        <p className="mt-4 leading-7 text-body">{d["controlled.body"]}</p>
        <Card className="mt-7 text-start">
          <p className="text-sm leading-6 text-body">{d["feedback.hosted"]}</p>
        </Card>
        <div className="mt-7 space-y-3">
          {feedback.status === "configured" ? (
            <FeedbackLink locale={locale} url={feedback.url} />
          ) : (
            <p className="rounded-productive border bg-section p-4 text-sm leading-6 text-body" role="status">
              {d["feedback.unavailable"]}
            </p>
          )}
          <Link
            className={buttonClasses({ className: "w-full", variant: "secondary" })}
            href={localizedPath(locale, "/dashboard")}
          >
            {d["feedback.dashboard"]}
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
}
