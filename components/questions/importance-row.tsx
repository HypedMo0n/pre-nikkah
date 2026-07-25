"use client";

import { cn } from "@/lib/utils";

export type Importance = "low" | "medium" | "high";

type ImportanceOption = {
  value: Importance;
  label: string;
};

export function ImportanceRow({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: Importance) => void;
  options: readonly ImportanceOption[];
  value: Importance;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-[0.6875rem] font-semibold uppercase leading-[1.2] tracking-[0.1em] text-muted">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          const high = option.value === "high";
          return (
            <label
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-2 py-2 text-center text-xs font-medium leading-tight transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97]",
                selected && high && "border-amber bg-amber-soft text-amber-ink",
                selected && !high && "border-green bg-green-soft text-green",
                !selected && "border-hairline bg-transparent text-muted",
              )}
              key={option.value}
            >
              <input
                checked={selected}
                className="sr-only"
                name={name}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
