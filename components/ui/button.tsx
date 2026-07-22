import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-white shadow-soft hover:bg-primary/95 active:scale-[0.97] active:opacity-90",
  secondary:
    "border-border bg-card text-primary hover:border-primary/30 hover:bg-primary-soft active:opacity-85",
  ghost:
    "border-transparent bg-transparent text-primary hover:bg-primary-soft active:opacity-85",
  danger:
    "border-concern bg-concern text-white hover:bg-concern/95 active:scale-[0.97] active:opacity-90",
};

export function buttonClasses({
  variant = "primary",
  className,
}: {
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  return cn(
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-productive border px-5 py-3 text-sm font-semibold transition-[color,background-color,border-color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:border-border disabled:bg-section disabled:text-ink-soft motion-reduce:transition-none",
    variantClasses[variant],
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, className })}
      {...props}
    />
  ),
);

Button.displayName = "Button";
