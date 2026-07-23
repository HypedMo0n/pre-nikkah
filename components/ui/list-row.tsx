import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Generic row for topic lists, comparison lists, and similar — a leading
// status marker, a title/subtitle pair, and a trailing chip or chevron.
// Polymorphic via `as` so a caller can render it as a Link, a button, or a
// plain li depending on whether the row navigates.
export function ListRow({
  as: As = "div",
  leading,
  title,
  subtitle,
  trailing,
  interactive = false,
  className,
  ...props
}: {
  as?: ElementType;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  interactive?: boolean;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <As
      className={cn(
        "flex items-center gap-3 rounded-card border border-hairline bg-white px-4 py-3.5",
        interactive && "transition-transform duration-150 ease-app-out active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      {leading ? (
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-productive text-[15px] font-semibold text-ink">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate font-productive text-[13px] text-muted">{subtitle}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </As>
  );
}
