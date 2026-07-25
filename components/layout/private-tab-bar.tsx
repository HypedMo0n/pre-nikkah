"use client";

import { GitCompareArrows, Home, ListChecks, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { getV3Copy } from "@/features/v3/copy";
import { cn } from "@/lib/utils";

export function PrivateTabBar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const d = getV3Copy(locale);
  const tabs = [
    { href: localizedPath(locale, "/dashboard"), icon: Home, label: d.home },
    { href: localizedPath(locale, "/topics"), icon: ListChecks, label: d.journey },
    { href: localizedPath(locale, "/comparisons"), icon: GitCompareArrows, label: d.discuss },
    { href: localizedPath(locale, "/settings"), icon: Settings, label: d.settings },
  ];
  return (
    <nav
      aria-label={`${d.appName} navigation`}
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-card pb-[max(env(safe-area-inset-bottom,0px),8px)]"
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-around">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 pt-2 text-ink-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active && "text-primary",
              )}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.4 : 2} />
              <span className={cn("max-w-full px-1 text-center text-[11px] leading-tight", active ? "font-semibold" : "font-medium")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
