"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type OptionCardProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "type"
> & {
  label: ReactNode;
  description: ReactNode;
};

export function OptionCard({
  checked,
  className,
  description,
  label,
  ...props
}: OptionCardProps) {
  return (
    <label
      className={cn(
        "group flex min-h-20 cursor-pointer items-start gap-3 rounded-option border bg-white px-[1.125rem] py-4 transition-[color,background-color,border-color,transform] duration-150 ease-expressive active:scale-[0.97]",
        checked
          ? "border-[1.5px] border-green bg-green-soft text-green"
          : "border-hairline text-ink",
        props.disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        {...props}
        checked={checked}
        className="peer sr-only"
        type="radio"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-[border-color] duration-150",
          checked ? "border-green" : "border-muted/50",
        )}
      >
        <span
          className={cn(
            "size-2.5 rounded-full bg-green transition-[opacity,transform] duration-150",
            checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold leading-5">
          {label}
        </span>
        <span className="mt-1 block text-[0.8125rem] leading-[1.4] text-muted">
          {description}
        </span>
      </span>
    </label>
  );
}
