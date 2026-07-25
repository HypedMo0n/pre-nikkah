"use client";

import { Flag, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { OptionCard } from "@/components/questions/option-card";
import { Chip } from "@/components/ui/chip";
import type { V3Copy } from "@/features/v3/copy";

export function HowItWorksDemo({ d }: { d: V3Copy }) {
  const [selected, setSelected] = useState("");
  const options = [
    d.demoOptionOne,
    d.demoOptionTwo,
    d.demoOptionThree,
    d.demoOptionFour,
  ];

  return (
    <div className="mt-8 space-y-4">
      <section className="rounded-card border border-hairline bg-white p-5">
        <p className="font-expressive text-xl leading-7 text-ink">
          {d.demoQuestion}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">{d.sampleAnswerHint}</p>
        <fieldset className="mt-5 grid gap-2">
          <legend className="sr-only">{d.chooseAnswer}</legend>
          {options.map((option, index) => (
            <OptionCard
              checked={selected === String(index)}
              description=""
              key={option}
              label={option}
              name="sample-answer"
              onChange={() => setSelected(String(index))}
              value={index}
            />
          ))}
        </fieldset>
        <div className="mt-4 flex min-h-11 items-center justify-between rounded-option bg-green-soft px-4 text-sm text-green">
          <span className="flex items-center gap-2 font-semibold">
            <Flag aria-hidden="true" size={16} />
            {d.importance}
          </span>
          <span>{d.importanceHigh}</span>
        </div>
      </section>

      <section className="rounded-card border border-hairline bg-white p-5">
        <p className="text-xs font-semibold text-muted">{d.partnerCard}</p>
        <div className="mt-4 flex items-center gap-3">
          <LockKeyhole aria-hidden="true" className="text-muted" size={17} />
          {selected ? (
            <Chip className="pattern-reveal" tone="discuss">
              {d.patternWorth}
            </Chip>
          ) : (
            <div className="min-w-0">
              <p
                aria-hidden="true"
                className="overflow-hidden whitespace-nowrap text-base tracking-[0.16em] text-hairline"
              >
                ••••••••••••••
              </p>
              <p className="mt-1 text-xs text-muted">{d.staysPrivate}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
