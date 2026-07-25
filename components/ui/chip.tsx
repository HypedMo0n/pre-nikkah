import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ChipTone = "neutral" | "aligned" | "discuss" | "priority";

const toneClasses: Record<ChipTone, string> = {
  neutral: "border-hairline bg-white text-muted",
  aligned: "border-green/20 bg-green-soft text-green",
  discuss: "border-amber/20 bg-amber-soft text-amber-ink",
  priority: "border-green bg-green text-white",
};

export function Chip({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-medium leading-none",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
