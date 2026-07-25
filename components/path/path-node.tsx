"use client";

import { motion } from "motion/react";

import { usePrefersReducedMotion } from "@/lib/motion/use-reduced-motion";

export type ArcColor = "hairline" | "green" | "amber";

const arcColorVar: Record<ArcColor, string> = {
  amber: "var(--amber)",
  green: "var(--green)",
  hairline: "var(--hairline)",
};

// §7.10: "the node glyph and the brand mark stay visually identical" — a
// 24px ring drawn as two semicircular arcs, left half is you, right half
// is your partner.
//
// §9 #7/#11: each arc draws via `pathLength` (Motion's own stroke-
// dashoffset abstraction) over 400ms var(--ease-in-out). The partner-
// pulse ("when your partner closes the ring, the node pulses once") is
// deliberately not implemented here — it fires on a live event, and
// nothing in this pass adds realtime subscriptions to detect one; a
// static heuristic (e.g. pulsing every already-complete node on every
// mount) would misrepresent that as motion tied to a change that didn't
// just happen, which is worse than omitting it.
export function PathNode({
  left,
  right,
  showDot = false,
  emphasized = false,
  size = 24,
}: {
  left: ArcColor;
  right: ArcColor;
  showDot?: boolean;
  emphasized?: boolean;
  size?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const strokeWidth = 2;
  const radius = size / 2 - strokeWidth / 2 - 0.5;
  const center = size / 2;
  const drawTransition = reduced
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.77, 0, 0.175, 1] as [number, number, number, number] };

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ height: size, width: size }}>
      {emphasized ? (
        <span
          aria-hidden="true"
          className="absolute rounded-full border border-green"
          style={{ height: 32, opacity: 0.3, width: 32 }}
        />
      ) : null}
      <svg aria-hidden="true" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <motion.path
          animate={{ pathLength: 1 }}
          d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 0 ${center} ${center + radius}`}
          fill="none"
          initial={{ pathLength: reduced ? 1 : 0 }}
          stroke={arcColorVar[left]}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transition={drawTransition}
        />
        <motion.path
          animate={{ pathLength: 1 }}
          d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 1 ${center} ${center + radius}`}
          fill="none"
          initial={{ pathLength: reduced ? 1 : 0 }}
          stroke={arcColorVar[right]}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transition={drawTransition}
        />
      </svg>
      {showDot ? (
        <span aria-hidden="true" className="absolute size-1.5 rounded-full bg-green" />
      ) : null}
    </span>
  );
}
