import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";

const trustPoints = [
  "No public profile or searchable identity",
  "No compatibility score",
  "Share exact answers only when you choose",
];

export default function WelcomePage() {
  return (
    <main>
      <Container className="grid min-h-[calc(100vh-4rem)] items-center gap-12 py-12 md:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)] md:py-20 lg:gap-20">
        <section aria-labelledby="welcome-heading" className="max-w-2xl">
          <BrandMark className="text-primary" size={42} />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Private premarital preparation
          </p>
          <h1
            className="font-expressive mt-3 text-balance text-4xl font-medium leading-[1.08] text-ink sm:text-5xl lg:text-6xl"
            id="welcome-heading"
          >
            You found someone. Now build the foundation.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-body sm:text-lg sm:leading-8">
            A private, guided space for two people considering marriage to talk
            through what matters before wedding planning begins.
          </p>

          <ul className="mt-8 space-y-3" role="list">
            {trustPoints.map((point) => (
              <li className="flex items-center gap-3 text-sm text-ink" key={point}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Check aria-hidden="true" size={14} strokeWidth={2.5} />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              className={buttonClasses({ className: "sm:min-w-64" })}
              href="/sign-up"
            >
              Start your private journey
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              className={buttonClasses({
                className: "sm:min-w-32",
                variant: "secondary",
              })}
              href="/sign-in"
            >
              Sign in
            </Link>
          </div>
        </section>

        <Card className="relative overflow-hidden border-primary/10 bg-card p-6 shadow-soft sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -end-16 -top-16 size-44 rounded-full bg-primary-soft/80"
          />
          <div className="relative">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <LockKeyhole aria-hidden="true" size={23} />
            </span>
            <h2 className="font-expressive mt-6 text-2xl font-medium text-ink">
              Privacy is part of the conversation.
            </h2>
            <p className="mt-3 leading-7 text-body">
              Your answers stay private. We compare patterns without showing
              your exact answers.
            </p>
            <div className="my-6 h-px bg-border" />
            <p className="text-sm leading-6 text-ink-soft">
              You choose whether to share a specific answer with your connected
              partner.
            </p>
          </div>
        </Card>
      </Container>
    </main>
  );
}
