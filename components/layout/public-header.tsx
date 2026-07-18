import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Container } from "@/components/ui/container";

export function PublicHeader() {
  return (
    <header className="border-b border-border/80 bg-background/95">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <BrandLockup />
        <Link
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-primary-soft"
          href="/sign-in"
        >
          Sign in
        </Link>
      </Container>
    </header>
  );
}
