import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create private account",
};

export default function SignUpPage() {
  return (
    <Card className="mt-16 p-6 sm:p-8">
      <h1 className="font-expressive text-3xl font-medium text-ink">
        Create your private account
      </h1>
      <p className="mt-3 leading-7 text-body">
        This account will be used only to save your progress and connect with
        one invited partner.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center rounded-xl font-semibold text-primary underline decoration-primary/30 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href="/"
      >
        Return to welcome
      </Link>
    </Card>
  );
}
