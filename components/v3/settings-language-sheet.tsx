"use client";

import { ChevronDown, Globe2, X } from "lucide-react";
import { useState } from "react";

import { updateLocaleAction } from "@/features/v3/actions";
import type { V3Copy } from "@/features/v3/copy";
import type { Locale } from "@/lib/i18n/config";

export function SettingsLanguageSheet({
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
  const current = languages.find((language) => language.code === locale);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex min-h-12 w-full items-center justify-between rounded-card border border-hairline bg-white px-4 text-start text-sm font-semibold text-ink transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="flex items-center gap-3">
          <Globe2 aria-hidden="true" className="text-green" size={18} />
          <span>
            <span className="block text-xs font-medium text-muted">
              {d.language}
            </span>
            <span>{current?.label ?? locale.toUpperCase()}</span>
          </span>
        </span>
        <ChevronDown aria-hidden="true" size={16} />
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
            <div className="mx-auto mt-4 grid max-h-[50vh] max-w-xl gap-2 overflow-y-auto">
              {languages.map((language) => (
                <form action={updateLocaleAction} key={language.code}>
                  <input name="locale" type="hidden" value={locale} />
                  <input
                    name="preferredLocale"
                    type="hidden"
                    value={language.code}
                  />
                  <button
                    aria-current={
                      language.code === locale ? "true" : undefined
                    }
                    className="flex min-h-14 w-full items-center justify-between rounded-option border border-hairline bg-white px-4 font-semibold text-ink transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                    type="submit"
                  >
                    {language.label}
                    <span className="text-xs text-muted">
                      {language.code.toUpperCase()}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
