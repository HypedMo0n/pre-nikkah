import { Languages, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export default function LanguageEntryPage() {
  return (
    <main>
      <Container className="flex min-h-screen max-w-lg items-center py-10 sm:py-16">
        <Card className="w-full overflow-hidden p-6 shadow-soft sm:p-9">
          <div className="flex items-center justify-between">
            <BrandMark className="text-primary" size={38} />
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Languages aria-hidden="true" size={21} />
            </span>
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Private premarital preparation
          </p>
          <h1 className="font-expressive mt-3 text-4xl font-medium leading-tight text-ink">
            Choose your language
          </h1>
          <p className="mt-3 leading-7 text-body">
            You can change this later in your private account settings.
          </p>

          <nav aria-label="Language" className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link className={buttonClasses({ className: "w-full" })} href="/en/welcome">
              English
            </Link>
            <Link
              className={buttonClasses({ className: "w-full", variant: "secondary" })}
              href="/fr/welcome"
            >
              Français
            </Link>
          </nav>

          <div className="mt-7 flex items-start gap-3 border-t pt-5 text-sm leading-6 text-ink-soft">
            <LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
            <p>No public profile, searchable identity, or compatibility score.</p>
          </div>
        </Card>
      </Container>
    </main>
  );
}
