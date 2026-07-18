import { Check, Circle, MessageCircle } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export type FoundationLayerState = "empty" | "completed" | "discussed";

export function FoundationVisual({ locale, layers }: { locale: Locale; layers: readonly FoundationLayerState[] }) {
  const d = getDictionary(locale);
  const labels = {
    empty: d["dashboard.notStarted"],
    completed: d["dashboard.completed"],
    discussed: d["dashboard.discussedState"],
  } as const;
  const icons = { empty: Circle, completed: Check, discussed: MessageCircle } as const;
  const completedTogether = layers.filter((state) => state !== "empty").length;
  const discussedTogether = layers.filter((state) => state === "discussed").length;
  return (
    <section aria-labelledby="foundation-title" className="overflow-hidden rounded-expressive border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="font-semibold text-ink" id="foundation-title">{d["dashboard.foundationTitle"]}</h2>
      <p className="mt-2 text-sm leading-6 text-body">{d["dashboard.foundationBody"]}</p>
      <div aria-hidden="true" className="relative mx-auto mt-7 aspect-[1.65/1] w-full max-w-sm overflow-hidden">
        {layers.map((state, index) => (
          <span
            className={cn(
              "absolute bottom-0 rounded-t-full border-[12px] border-b-0 min-[360px]:border-[14px] min-[360px]:border-b-0",
              state === "empty" && "border-section",
              state === "completed" && "border-primary/35",
              state === "discussed" && "border-accent",
            )}
            key={`${state}-arch-${index}`}
            style={{
              height: `${100 - index * 19}%`,
              insetInline: `${index * 9}%`,
              zIndex: layers.length - index,
            }}
          />
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-y py-4 text-center">
        <div>
          <dt className="text-xs leading-5 text-ink-soft">{d["dashboard.completedTogether"]}</dt>
          <dd className="mt-1 text-2xl font-semibold text-ink">{completedTogether}</dd>
        </div>
        <div>
          <dt className="text-xs leading-5 text-ink-soft">{d["dashboard.discussed"]}</dt>
          <dd className="mt-1 text-2xl font-semibold text-ink">{discussedTogether}</dd>
        </div>
      </dl>
      <ol className="mt-4 space-y-2" aria-label={d["dashboard.completedTogether"]}>
        {layers.map((state, index) => {
          const Icon = icons[state];
          return (
            <li className={cn("flex min-h-11 items-center gap-3 rounded-productive border px-4 text-sm font-medium", state === "completed" && "bg-primary-soft text-primary", state === "discussed" && "border-accent bg-accent/15 text-ink", state === "empty" && "bg-background text-ink-soft")} key={`${state}-${index}`}>
              <Icon aria-hidden="true" size={17} />
              <span>{index + 1}. {labels[state]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
