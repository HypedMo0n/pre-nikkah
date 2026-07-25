import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Field({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-12 w-full rounded-field border border-hairline bg-white px-4 py-3 text-[0.9375rem] text-ink outline-none placeholder:text-muted/70 focus:border-green focus:ring-2 focus:ring-green/15",
        className,
      )}
      {...props}
    />
  );
}
