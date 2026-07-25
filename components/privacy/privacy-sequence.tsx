"use client";

import { ArrowRight, DatabaseZap, LockKeyhole, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function PrivacySequence({ locale }: { locale: Locale }) {
  const [step, setStep] = useState(0);
  const d = getDictionary(locale);
  const beats = [
    { Icon: LockKeyhole, text: d["privacy.beatOne"] },
    { Icon: DatabaseZap, text: d["privacy.beatTwo"] },
    { Icon: Trash2, text: d["privacy.beatThree"] },
  ];
  const current = beats[step];

  return (
    <div className="flex min-h-[34rem] flex-col justify-between">
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-expressive bg-primary-soft text-primary">
          <current.Icon aria-hidden="true" size={25} />
        </span>
        <p className="font-expressive mt-7 max-w-sm text-2xl font-medium leading-snug text-ink">{current.text}</p>
        <div aria-label={`${step + 1} of ${beats.length}`} className="mt-7 flex gap-2" role="status">
          {beats.map((beat, index) => (
            <span
              aria-hidden="true"
              className={index === step ? "h-1.5 w-6 rounded-full bg-primary" : "size-1.5 rounded-full bg-border"}
              key={beat.text}
            />
          ))}
        </div>
      </div>
      <p className="mb-3 rounded-productive border bg-section p-3 text-xs leading-5 text-ink-soft">{d["privacy.technical"]}</p>
      {/* Off-ramp from onboarding: reachable before an account exists. */}
      <Link
        className="mb-5 block text-center text-sm font-semibold text-primary underline underline-offset-4"
        href={localizedPath(locale, "/resources")}
      >
        {d["safety.link"]}
      </Link>
      {step < beats.length - 1 ? (
        <Button className="w-full" onClick={() => setStep((value) => value + 1)}>
          {d["common.next"]}
          <ArrowRight aria-hidden="true" size={18} />
        </Button>
      ) : (
        <Link className={buttonClasses({ className: "w-full" })} href={localizedPath(locale, "/journey")}>
          {d["common.continue"]}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      )}
    </div>
  );
}
