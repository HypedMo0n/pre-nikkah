import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";

type SharedProps = {
  label?: string;
  dashed?: boolean;
  className?: string;
};

const fieldBase =
  "w-full rounded-input border bg-white px-4 py-3 font-productive text-[15px] text-ink placeholder:text-muted focus-visible:outline-none";

function fieldBorder(dashed: boolean) {
  return dashed ? "border-dashed border-hairline" : "border-hairline";
}

// §7.7's private-note field is the dashed variant; every other text input
// in the product uses the solid one. Both share the same 14px radius token.
export function Field({
  label,
  dashed = false,
  className,
  id,
  ...inputProps
}: SharedProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={className}>
      {label ? (
        <label className="mb-1.5 block font-productive text-[13px] font-medium text-muted" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <input className={cn(fieldBase, fieldBorder(dashed))} id={fieldId} {...inputProps} />
    </div>
  );
}

export function TextAreaField({
  label,
  dashed = false,
  className,
  id,
  ...textareaProps
}: SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={className}>
      {label ? (
        <label className="mb-1.5 block font-productive text-[13px] font-medium text-muted" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <textarea className={cn(fieldBase, fieldBorder(dashed), "min-h-24 resize-none")} id={fieldId} {...textareaProps} />
    </div>
  );
}
