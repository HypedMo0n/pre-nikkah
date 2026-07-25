"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { removeLocalePrefix } from "@/lib/auth/paths";
import type { Locale } from "@/lib/i18n/config";
import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { setLocaleCookie } from "@/lib/i18n/set-locale-cookie";

function GlobeGlyph() {
  return (
    <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
      <circle cx="7" cy="7" fill="none" r="6" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="7" cy="7" fill="none" rx="2.7" ry="6" stroke="currentColor" strokeWidth="1" />
      <line stroke="currentColor" strokeWidth="1" x1="1" x2="13" y1="7" y2="7" />
    </svg>
  );
}

function endonym(locale: Locale) {
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
}

// §7.1 + §7.12: "Language (same sheet as the welcome pill)" — one
// component, two trigger shapes. "pill" is the compact top-right control
// (Welcome); "row" matches Settings' other grouped rows. Both open the
// identical sheet, driven by the `locales` array with each name rendered
// via Intl.DisplayNames in its own endonym rather than a hardcoded label
// map — "Not a segmented control — the list will grow" holds regardless
// of how many languages are configured (see task #17's later audit).
export function LocalePicker({ locale, variant = "pill" }: { locale: Locale; variant?: "pill" | "row" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const d = getDictionary(locale);

  function selectLocale(next: Locale) {
    setLocaleCookie(next);
    const rest = removeLocalePrefix(pathname);
    router.push(`/${next}${rest === "/" ? "" : rest}`);
    setOpen(false);
  }

  return (
    <>
      {variant === "pill" ? (
        <button
          aria-label={d["common.language"]}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/70 px-3 py-1.5 font-productive text-[13px] font-medium text-ink"
          onClick={() => setOpen(true)}
          type="button"
        >
          <GlobeGlyph />
          <span className="uppercase">{locale}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      ) : (
        <button
          className="flex w-full items-center justify-between rounded-card border border-hairline bg-white px-4 py-3.5 text-left"
          onClick={() => setOpen(true)}
          type="button"
        >
          <span className="font-productive text-[15px] font-semibold text-ink">{d["common.language"]}</span>
          <span className="font-productive text-[13px] text-muted">{endonym(locale)}</span>
        </button>
      )}
      <Sheet onClose={() => setOpen(false)} open={open} title={d["common.language"]}>
        <ul>
          {locales.map((option) => (
            <li key={option}>
              <button
                className="flex w-full items-center justify-between rounded-input px-4 py-3 text-left font-productive text-[15px] text-ink"
                onClick={() => selectLocale(option)}
                type="button"
              >
                <span className="capitalize">{endonym(option)}</span>
                {option === locale ? (
                  <span aria-hidden="true" className="text-green">
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
