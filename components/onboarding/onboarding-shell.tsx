import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { PrivateTabBar } from "@/components/layout/private-tab-bar";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

export function OnboardingShell({
  backHref,
  children,
  locale,
  productive = false,
  withTabBar = false,
}: {
  backHref?: string;
  children: React.ReactNode;
  locale: Locale;
  productive?: boolean;
  withTabBar?: boolean;
}) {
  return (
    <main className="safe-screen">
      <Container className={`min-h-[100svh] max-w-xl py-5 sm:py-8 ${withTabBar ? "pb-24" : ""}`}>
        <header className="flex min-h-12 items-center justify-between gap-4">
          {backHref ? (
            <Link
              aria-label={translate(locale, "common.back")}
              className="flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={backHref}
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </Link>
          ) : (
            <span className="size-11" />
          )}
          <BrandLockup className="text-sm" href={localizedPath(locale, "/dashboard")} />
          <span className="size-11" />
        </header>
        <div className={productive ? "pt-7" : "pt-10 sm:pt-16"}>{children}</div>
      </Container>
      {withTabBar ? <PrivateTabBar locale={locale} /> : null}
    </main>
  );
}
