import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { isLocale, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function VerifyEmailPage({
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
        <Card className="w-full p-6 text-center shadow-soft sm:p-8">
          <h1 className="font-expressive text-3xl font-light text-ink">{d["auth.verifyTitle"]}</h1>
          <p className="mt-3 font-productive text-[15px] leading-6 text-muted">{d["auth.verifyBody"]}</p>
        </Card>
      </Container>
    </main>
  );
}
