"use client";

import { ChevronDown, Globe2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { V3Copy } from "@/features/v3/copy";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";

export function LanguageSheet({
  d,
  locale,
}: {
  d: V3Copy;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const languages: { code: Locale; label: string }[] = [
    { code: "en", label: d.english },
    { code: "fr", label: d.french },
  ];

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fixed right-4 top-4 z-30 flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-white/70 px-4 text-sm font-semibold text-ink backdrop-blur-md transition-transform active:scale-[0.97]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Globe2 aria-hidden="true" size={14} />
        {locale.toUpperCase()}
        <ChevronDown aria-hidden="true" size={14} />
      </button>

      {open ? (
        <div
          aria-label={d.chooseLanguage}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end bg-ink/45"
          role="dialog"
        >
          <button
            aria-label={d.cancel}
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
            type="button"
          />
          <section className="relative w-full rounded-t-[1.75rem] bg-ivory px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-soft">
            <div className="mx-auto flex max-w-xl items-center justify-between">
              <h2 className="font-expressive text-2xl font-medium text-ink">
                {d.chooseLanguage}
              </h2>
              <button
                aria-label={d.cancel}
                className="flex size-11 items-center justify-center rounded-full text-ink transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <nav
              aria-label={d.chooseLanguage}
              className="mx-auto mt-4 grid max-h-[50vh] max-w-xl gap-2 overflow-y-auto"
            >
              {languages.map((language) => (
                <Link
                  aria-current={language.code === locale ? "page" : undefined}
                  className="flex min-h-14 items-center justify-between rounded-option border border-hairline bg-white px-4 font-semibold text-ink transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                  href={localizedPath(language.code, "/welcome")}
                  key={language.code}
                >
                  {language.label}
                  <span className="text-xs text-muted">
                    {language.code.toUpperCase()}
                  </span>
                </Link>
              ))}
            </nav>
          </section>
        </div>
      ) : null}
    </>
  );
}
