import Link from "next/link";
import { notFound } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const { next } = await searchParams;
  const d = getDictionary(locale);

  return (
    <main>
      <Container className="flex min-h-screen items-center py-10">
        <Card className="w-full p-6 shadow-soft sm:p-8">
          <h1 className="font-expressive text-3xl font-light text-ink">{d["auth.signInTitle"]}</h1>
          <p className="mt-2 font-productive text-[15px] text-muted">{d["auth.signInBody"]}</p>
          <SignInForm locale={locale} next={next} />
          <div className="mt-6 flex flex-col gap-2 text-center font-productive text-[13px]">
            <Link className="text-green underline underline-offset-2" href={localizedPath(locale, "/forgot-password")}>
              {d["auth.forgot"]}
            </Link>
            <span className="text-muted">
              {d["auth.hasSpace"]}{" "}
              <Link className="text-green underline underline-offset-2" href={localizedPath(locale, "/create-space")}>
                {d["createSpace.title"]}
              </Link>
            </span>
          </div>
        </Card>
      </Container>
    </main>
  );
}
