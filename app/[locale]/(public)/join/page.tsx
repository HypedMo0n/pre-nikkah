import { notFound } from "next/navigation";

import { JoinCodeForm } from "@/components/invites/join-code-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { isLocale, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function JoinPage({
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
          <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.12em] text-green">
            {d["join.eyebrow"]}
          </p>
          <h1 className="font-expressive mt-2 text-3xl font-light text-ink">{d["join.title"]}</h1>
          <p className="mt-2 font-productive text-[15px] text-muted">{d["join.body"]}</p>
          <JoinCodeForm locale={locale} />
        </Card>
      </Container>
    </main>
  );
}
