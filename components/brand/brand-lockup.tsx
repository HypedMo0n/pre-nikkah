import Link from "next/link";

import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

import { BrandMark } from "./brand-mark";

export function BrandLockup({ className }: { className?: string }) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
      href="/"
    >
      <BrandMark size={28} />
      <span className="text-sm font-semibold text-ink">{brand.name}</span>
    </Link>
  );
}
