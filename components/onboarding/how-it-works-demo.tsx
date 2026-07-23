"use client";

import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { ImportanceRow } from "@/components/ui/importance-row";
import { OptionCard } from "@/components/ui/option-card";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.2: "An interactive demonstration, not static copy." Reuses the real
// OptionCard/ImportanceRow/Chip primitives so it commits with the same
// visual language as the actual answer and comparison screens — nothing
// here is persisted, it's illustrative content only.
export function HowItWorksDemo({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const demoOptions = [
    { description: d["howItWorks.demoOptionEarnerDescription"], key: "earner", label: d["howItWorks.demoOptionEarnerLabel"] },
    { description: d["howItWorks.demoOptionTogetherDescription"], key: "together", label: d["howItWorks.demoOptionTogetherLabel"] },
    { description: d["howItWorks.demoOptionLeadDescription"], key: "lead", label: d["howItWorks.demoOptionLeadLabel"] },
    { description: d["howItWorks.demoOptionSeparateDescription"], key: "separate", label: d["howItWorks.demoOptionSeparateLabel"] },
  ];

  return (
    <div className="mt-7">
      <p className="font-productive text-[15px] font-semibold text-ink">{d["howItWorks.demoQuestion"]}</p>
      <div className="mt-3 space-y-2.5" role="radiogroup">
        {demoOptions.map((option) => (
          <OptionCard
            checked={selected === option.key}
            description={option.description}
            key={option.key}
            label={option.label}
            name="demoOption"
            onChange={() => {
              setSelected(option.key);
              setRevealed(false);
            }}
            value={option.key}
          />
        ))}
      </div>

      {selected ? (
        <ImportanceRow
          className="mt-4"
          eyebrow={d["answer.eyebrow"]}
          key={selected}
          labels={{ high: d["importance.high"], low: d["importance.low"], medium: d["importance.medium"] }}
          name="demoImportance"
        />
      ) : null}

      {selected ? (
        <div className="mt-5 rounded-card border border-hairline bg-white p-4">
          <p className="font-productive text-[13px] font-semibold text-ink">{d["demo.partnerLabel"]}</p>
          {revealed ? (
            <div className="mt-2.5">
              <Chip variant="discuss">{d["demo.pattern"]}</Chip>
            </div>
          ) : (
            <>
              <div aria-hidden="true" className="mt-2.5 flex flex-wrap gap-1.5">
                {Array.from({ length: 14 }, (_, index) => (
                  <span className="size-2 rounded-full bg-hairline" key={index} />
                ))}
              </div>
              <p className="mt-1.5 font-productive text-[12px] text-muted">{d["demo.staysPrivate"]}</p>
              <button
                className="mt-3 font-productive text-[13px] font-medium text-green underline underline-offset-2"
                onClick={() => setRevealed(true)}
                type="button"
              >
                {d["demo.reveal"]}
              </button>
            </>
          )}
        </div>
      ) : null}

      <p className="mt-4 font-productive text-[12.5px] leading-5 text-muted">{d["demo.caption"]}</p>
    </div>
  );
}
