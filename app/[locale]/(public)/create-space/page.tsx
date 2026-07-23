import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountForm } from "@/components/auth/account-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getInviteIntent } from "@/lib/auth/invite-intent";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.3. Account creation and space creation are the same screen: this
// form creates the auth account (signUpAction); the space itself is
// created on /invite, the first time an authenticated user with no
// current space reaches it. When an invite-intent cookie is already set
// (the visitor arrived via /join/[code] as a signed-out user), the same
// form switches to join-flavored copy instead of a second screen.
export default async function CreateSpacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);
  const intent = await getInviteIntent();
  const entryMode = intent ? "join" : "create";

  return (
    <main>
      <Container className="flex min-h-screen items-center py-10">
        <Card className="w-full p-6 shadow-soft sm:p-8">
          <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.12em] text-green">
            {entryMode === "join" ? d["join.eyebrow"] : d["createSpace.eyebrow"]}
          </p>
          <h1 className="font-expressive mt-2 text-3xl font-light text-ink">
            {entryMode === "join" ? d["join.title"] : d["createSpace.title"]}
          </h1>
          <p className="mt-2 font-productive text-[15px] text-muted">
            {entryMode === "join" ? d["join.body"] : d["createSpace.body"]}
          </p>
          <AccountForm
            actionLabel={entryMode === "join" ? d["join.action"] : d["createSpace.action"]}
            entryMode={entryMode}
            locale={locale}
          />
          <p className="mt-6 text-center font-productive text-[13px] text-muted">
            {d["auth.hasSpace"]}{" "}
            <Link className="text-green underline underline-offset-2" href={localizedPath(locale, "/sign-in")}>
              {d["auth.signInAction"]}
            </Link>
          </p>
        </Card>
      </Container>
    </main>
  );
}
