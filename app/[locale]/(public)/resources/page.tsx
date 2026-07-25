import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { QuickExit } from "@/components/safety/quick-exit";
import { Card } from "@/components/ui/card";
import { getV3Copy } from "@/features/v3/copy";
import { isLocale } from "@/lib/i18n/config";

/**
 * Safety and off-ramp surface.
 *
 * Deliberately public: someone affected by coercion may not be able to reach a
 * signed-in screen safely, so this route is outside `protectedPrefixes` and
 * makes no Supabase call at all.
 *
 * Deliberately static: nothing here reads an answer, a topic, or any per-user
 * state. The app never inspects answer content to decide what to show, and a
 * safety feature must not be the thing that breaks that rule.
 *
 * Deliberately jurisdiction-agnostic: shipping one country's hotline to
 * everyone is worse than useless, so this points at local emergency services
 * and local organisations rather than naming any.
 */
export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getV3Copy(locale);

  return (
    <OnboardingShell locale={locale}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-ink">
        {d.safetyEyebrow}
      </p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">
        {d.safetyTitle}
      </h1>
      <p className="mt-4 leading-7 text-muted">{d.safetyIntro}</p>

      <div className="mt-6">
        <QuickExit locale={locale} />
        <p className="mt-2 text-center text-xs leading-5 text-muted">
          {d.safetyQuickExitHint}
        </p>
      </div>

      <Card className="mt-8">
        <h2 className="font-semibold text-ink">{d.safetySignsTitle}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          {d.safetySigns.map((sign) => (
            <li key={sign}>• {sign}</li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-ink">{d.safetyStepsTitle}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          {d.safetySteps.map((step) => (
            <li key={step}>• {step}</li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-ink">{d.safetyAppNoteTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {d.safetyAppNoteBody}
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-ink">{d.safetyDeviceTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {d.safetyDeviceBody}
        </p>
      </Card>
    </OnboardingShell>
  );
}
