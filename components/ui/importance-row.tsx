import { cn } from "@/lib/utils";

export type ImportanceLevel = "low" | "medium" | "high";

const levels: { value: ImportanceLevel; labelKey: string }[] = [
  { value: "low", labelKey: "importance.low" },
  { value: "medium", labelKey: "importance.medium" },
  { value: "high", labelKey: "importance.high" },
];

// §7.7 + §9 #2. Three levels only. "Non-negotiable" gets amber-soft/
// amber-ink when selected — every other level (including this row's own
// default, "medium") gets green-soft/green — because raising the
// importance to its highest level is meant to feel weightier without
// reading as an error. Press feedback matches the option card; the fill/
// border/label color crossfade over the same 150ms with no movement — "it
// must feel like a switch, not an animation."
export function ImportanceRow({
  name,
  defaultValue = "medium",
  eyebrow,
  labels,
  className,
  ...radioProps
}: {
  name: string;
  defaultValue?: ImportanceLevel;
  eyebrow: string;
  labels: Record<ImportanceLevel, string>;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "name" | "value" | "defaultChecked">) {
  return (
    <div className={className}>
      <p className="font-productive text-[11px] font-semibold uppercase tracking-[0.10em] text-muted">
        {eyebrow}
      </p>
      <div className="mt-2 flex gap-2" role="radiogroup">
        {levels.map((level) => (
          <label
            key={level.value}
            className={cn(
              "flex-1 touch-target cursor-pointer rounded-full border border-hairline px-3 py-2 text-center font-productive text-[13px] font-medium text-muted",
              "transition-[transform,background-color,border-color,color] duration-150 ease-app-out active:scale-[0.97]",
              level.value === "high"
                ? "has-[:checked]:border-amber has-[:checked]:bg-amber-soft has-[:checked]:text-amber-ink"
                : "has-[:checked]:border-green has-[:checked]:bg-green-soft has-[:checked]:text-green",
            )}
          >
            <input
              className="sr-only"
              defaultChecked={defaultValue === level.value}
              name={name}
              type="radio"
              value={level.value}
              {...radioProps}
            />
            {labels[level.value]}
          </label>
        ))}
      </div>
    </div>
  );
}
