import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: number;
};

export function BrandMark({ className, size = 32 }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      fill="none"
      height={size}
      viewBox="0 0 40 40"
      width={size}
    >
      <path
        d="M6 30C6 17 14 8 24 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3.5"
      />
      <path
        className="text-accent"
        d="M34 10C34 23 26 32 16 32"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3.5"
      />
    </svg>
  );
}
