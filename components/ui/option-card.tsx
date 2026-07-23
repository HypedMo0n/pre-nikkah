import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

// §7.7. A native radio input drives selection (keyboard/screen-reader
// correct) but is visually hidden; the label is the entire hit target.
// Every conditional style is scoped through has-[:checked] on the label
// itself (the input is its descendant, so :has(:checked) matches) with
// arbitrary descendant selectors keyed on data-role — this reaches nested
// elements that a plain peer-checked sibling selector could not.
export function OptionCard({
  label,
  description,
  className,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-[10px] rounded-option border border-hairline bg-white px-[18px] py-4",
        "has-[:checked]:border-[1.5px] has-[:checked]:border-green has-[:checked]:bg-green-soft",
        "has-[:checked]:[&_[data-role=dot]]:block",
        "has-[:checked]:[&_[data-role=ring]]:border-green",
        "has-[:checked]:[&_[data-role=title]]:text-green",
        "transition-transform duration-150 ease-app-out active:scale-[0.97]",
        className,
      )}
    >
      <input className="sr-only" type="radio" {...inputProps} />
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-hairline"
        data-role="ring"
      >
        <span className="hidden size-[10px] rounded-full bg-green" data-role="dot" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-productive text-[15px] font-semibold leading-[1.4] text-ink" data-role="title">
          {label}
        </span>
        <span className="font-productive text-[13px] leading-[1.4] text-muted">{description}</span>
      </span>
    </label>
  );
}
