import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

// §8 primary/secondary spec. Press feedback uses CSS :active rather than a
// pointer-down JS handler — :active engages at pointer-down and releases at
// pointer-up, which is exactly the "feedback on pointer-down, not release"
// requirement, without extra state or a listener per button.
const base =
  "touch-target inline-flex items-center justify-center gap-2 rounded-full px-6 py-[17px] font-productive text-base font-semibold transition-transform duration-150 ease-app-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary: "bg-green text-white",
  secondary: "border-[1.2px] border-green bg-transparent text-green",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClasses({
  variant = "primary",
  className,
}: {
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClasses({ variant, className })} {...props} />;
}
