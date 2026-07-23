import { notFound } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { isLocale, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);

  return (
    <main>
      <Container className="flex min-h-screen items-center py-10">
        <Card className="w-full p-6 shadow-soft sm:p-8">
          <h1 className="font-expressive text-3xl font-light text-ink">{d["auth.resetTitle"]}</h1>
          <ResetPasswordForm locale={locale} />
        </Card>
      </Container>
    </main>
  );
}
