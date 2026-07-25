import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

// §7.7. A native radio input drives selection (keyboard/screen-reader
// correct) but is visually hidden; the label is the entire hit target.
// Every conditional style is scoped through has-[:checked] on the label
// itself (the input is its descendant, so :has(:checked) matches) with
// arbitrary descendant selectors keyed on data-role — this reaches nested
// elements that a plain peer-checked sibling selector could not.
//
// §9 #1: press feedback on pointer-down via CSS transition (not a
// keyframe), color crossfade on selection, and the radio dot scaling in
// 0.5→1 — the dot is always rendered (never `display: none`) so that
// scale/opacity transition actually plays instead of popping.
//
// The ring/dot/title selected-state colors are driven by the plain
// `.option-card` CSS in globals.css, not a Tailwind has-[:checked]:
// arbitrary variant — that pattern silently never compiled (see the
// comment there). Only the label's own direct has-[:checked]: classes
// below (border/background) are real Tailwind utilities.
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
        "option-card flex cursor-pointer items-start gap-[10px] rounded-option border border-hairline bg-white px-[18px] py-4",
        "transition-[transform,background-color,border-color] duration-150 ease-app-out active:scale-[0.97]",
        "has-[:checked]:border-[1.5px] has-[:checked]:border-green has-[:checked]:bg-green-soft",
        className,
      )}
    >
      <input className="sr-only" type="radio" {...inputProps} />
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-hairline transition-colors duration-150 ease-app-out"
        data-role="ring"
      >
        <span
          className="scale-50 rounded-full bg-green opacity-0 transition-[transform,opacity] duration-300 ease-app-out size-[10px]"
          data-role="dot"
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span
          className="font-productive text-[15px] font-semibold leading-[1.4] text-ink transition-colors duration-150 ease-app-out"
          data-role="title"
        >
          {label}
        </span>
        <span className="font-productive text-[13px] leading-[1.4] text-muted">{description}</span>
      </span>
    </label>
  );
}
