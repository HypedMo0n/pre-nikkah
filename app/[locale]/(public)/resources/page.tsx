import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { QuickExit } from "@/components/safety/quick-exit";
import { Card } from "@/components/ui/card";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

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
export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);

  const signs = [d["safety.signOne"], d["safety.signTwo"], d["safety.signThree"], d["safety.signFour"]];
  const steps = [d["safety.stepEmergency"], d["safety.stepTrusted"], d["safety.stepLocal"], d["safety.stepProfessional"]];

  return (
    <OnboardingShell locale={locale}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{d["safety.eyebrow"]}</p>
      <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">{d["safety.title"]}</h1>
      <p className="mt-4 leading-7 text-body">{d["safety.intro"]}</p>

      <div className="mt-6">
        <QuickExit locale={locale} />
        <p className="mt-2 text-center text-xs leading-5 text-ink-soft">{d["safety.quickExitHint"]}</p>
      </div>

      <Card className="mt-8 p-5">
        <h2 className="text-lg font-semibold text-ink">{d["safety.signsTitle"]}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-body">
          {signs.map((sign) => (
            <li key={sign}>• {sign}</li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-ink">{d["safety.stepsTitle"]}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-body">
          {steps.map((step) => (
            <li key={step}>• {step}</li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-ink">{d["safety.appNoteTitle"]}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{d["safety.appNoteBody"]}</p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-ink">{d["safety.deviceTitle"]}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{d["safety.deviceBody"]}</p>
      </Card>
    </OnboardingShell>
  );
}
