import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-green text-white hover:opacity-95 active:scale-[0.97]",
  secondary:
    "border-green bg-transparent text-green hover:bg-green-soft active:scale-[0.97]",
  ghost:
    "border-transparent bg-transparent text-green hover:bg-green-soft active:scale-[0.97]",
  danger:
    "border-danger bg-danger text-white hover:opacity-95 active:scale-[0.97]",
};

export function buttonClasses({
  variant = "primary",
  className,
}: {
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  return cn(
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-6 py-[1.0625rem] text-base font-semibold leading-none transition-[color,background-color,border-color,opacity,transform] duration-150 ease-expressive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:pointer-events-none disabled:border-hairline disabled:bg-track disabled:text-muted motion-reduce:transition-none",
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
