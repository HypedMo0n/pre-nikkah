import { notFound } from "next/navigation";

import { JoinCodeForm } from "@/components/invites/join-code-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getV3Copy } from "@/features/v3/copy";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getV3Copy(locale);
  return (
    <OnboardingShell
      backHref={localizedPath(locale, "/welcome")}
      locale={locale}
    >
      <h1 className="font-expressive text-4xl font-medium text-ink">
        {d.joinTitle}
      </h1>
      <p className="mt-4 leading-7 text-muted">{d.joinBody}</p>
      <JoinCodeForm locale={locale} />
    </OnboardingShell>
  );
}
