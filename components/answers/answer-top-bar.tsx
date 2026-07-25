"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { usePrefersReducedMotion } from "@/lib/motion/use-reduced-motion";

// §7.7's top bar: "✕", a thin progress track, and "5 / 6".
//
// §9 #8: progress tracks animate via `transform: scaleX()` from a fixed
// left origin, never `width` — this fills in on mount rather than sitting
// static, since each question is its own page load (no persistent client
// instance to diff a "previous" value against). Reduced motion renders
// straight at the target value, no fill-in.
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
  const reduced = usePrefersReducedMotion();

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
        <motion.div
          animate={{ scaleX: progress }}
          className="h-full origin-left rounded-full bg-green"
          initial={{ scaleX: reduced ? progress : 0 }}
          transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      </div>
      <span className="shrink-0 font-productive text-[13px] font-medium text-muted">
        {index} / {total}
      </span>
    </div>
  );
}
