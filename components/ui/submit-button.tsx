"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonVariant } from "./button";

export function SubmitButton({
  pendingLabel,
  children,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string;
  variant?: ButtonVariant;
}) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" variant={variant} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
