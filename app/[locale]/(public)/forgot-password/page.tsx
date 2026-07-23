import { notFound } from "next/navigation";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { isLocale, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ForgotPasswordPage({
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
          <h1 className="font-expressive text-3xl font-light text-ink">{d["auth.forgotTitle"]}</h1>
          <p className="mt-2 font-productive text-[15px] text-muted">{d["auth.forgotBody"]}</p>
          <ForgotPasswordForm locale={locale} />
        </Card>
      </Container>
    </main>
  );
}
