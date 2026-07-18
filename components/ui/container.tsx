import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Container({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full min-w-0 max-w-6xl px-4 min-[360px]:px-5 sm:px-8", className)}
      {...props}
    />
  );
}
