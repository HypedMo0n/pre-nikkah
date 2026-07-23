export type ArcColor = "hairline" | "green" | "amber";

const arcColorVar: Record<ArcColor, string> = {
  amber: "var(--amber)",
  green: "var(--green)",
  hairline: "var(--hairline)",
};

// §7.10: "the node glyph and the brand mark stay visually identical" — a
// 24px ring drawn as two semicircular arcs, left half is you, right half
// is your partner. Static for now; the stroke-dashoffset draw-in and the
// partner-pulse belong to the §9 motion pass (task #16).
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
  const strokeWidth = 2;
  const radius = size / 2 - strokeWidth / 2 - 0.5;
  const center = size / 2;

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
        <path
          d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 0 ${center} ${center + radius}`}
          fill="none"
          stroke={arcColorVar[left]}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        <path
          d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 1 ${center} ${center + radius}`}
          fill="none"
          stroke={arcColorVar[right]}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </svg>
      {showDot ? (
        <span aria-hidden="true" className="absolute size-1.5 rounded-full bg-green" />
      ) : null}
    </span>
  );
}
