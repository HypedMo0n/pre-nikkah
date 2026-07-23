import Link from "next/link";

import { cn } from "@/lib/utils";

// §7.7's top bar: "✕", a thin progress track, and "5 / 6". The track fills
// left-to-right by index/total — no animation here, that belongs to the
// §9 motion pass.
export function AnswerTopBar({
  exitHref,
  exitLabel,
  index,
  total,
}: {
  exitHref: string;
  exitLabel: string;
  index: number;
  total: number;
}) {
  const progress = total > 0 ? Math.min(1, index / total) : 0;
  return (
    <div className="flex items-center gap-4">
      <Link
        aria-label={exitLabel}
        className="touch-target flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-transform duration-150 ease-app-out active:scale-90"
        href={exitHref}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ✕
        </span>
      </Link>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-track">
        <div className={cn("h-full rounded-full bg-green")} style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="shrink-0 font-productive text-[13px] font-medium text-muted">
        {index} / {total}
      </span>
    </div>
  );
}
