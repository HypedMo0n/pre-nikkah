import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

// §8: "page padding 28px horizontal ... centered max-width column on
// desktop. No separate desktop layout."
export function Container({
  as: As = "div",
  children,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <As className={cn("mx-auto w-full max-w-md px-7", className)}>
      {children}
    </As>
  );
}
