import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  aligned: "border-transparent bg-green-soft text-green",
  discuss: "border-transparent bg-amber-soft text-amber-ink",
  neutral: "border-hairline bg-transparent text-muted",
} as const;

export type ChipVariant = keyof typeof variants;

// Status is never color-only (§ verification checklist): callers pass
// visible text, never rely on the chip's color alone to carry meaning.
// `dot` renders the small filled marker §7.8 uses before a high-priority
// row's chip.
export function Chip({
  variant = "neutral",
  dot = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: ChipVariant; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-productive text-[13px] font-medium",
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", variant === "discuss" ? "bg-amber" : "bg-green")} />
      ) : null}
      {children}
    </span>
  );
}
