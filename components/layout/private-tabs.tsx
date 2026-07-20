import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function PrivateTabs({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const items = [
    { href: localizedPath(locale, "/dashboard"), label: d["nav.home"] },
    { href: localizedPath(locale, "/topics"), label: d["nav.topics"] },
    { href: localizedPath(locale, "/comparisons"), label: d["nav.compare"] },
    { href: localizedPath(locale, "/settings"), label: d["nav.settings"] },
  ];
  return (
    <nav aria-label={d["nav.private"]} className="sticky bottom-0 z-20 border-t bg-background/95 px-3 py-2 backdrop-blur sm:top-0 sm:bottom-auto">
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1 text-center text-xs font-semibold text-ink-soft">
        {items.map((item) => <li key={item.href}><Link className="block rounded-productive px-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={item.href}>{item.label}</Link></li>)}
      </ul>
    </nav>
  );
}
