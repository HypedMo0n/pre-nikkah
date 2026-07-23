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

// §7.1: "Not a segmented control — the list will grow." Driven by the
// `locales` array, and each name is rendered via Intl.DisplayNames rather
// than a hardcoded label map, so a third locale needs no change here at
// all — the sheet (and task #17's later audit) both hold regardless of
// how many languages are configured.
function endonym(locale: Locale) {
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
}

export function LocalePicker({ locale }: { locale: Locale }) {
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
