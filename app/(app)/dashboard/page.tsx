import type { Metadata } from "next";

import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <main>
      <Container className="py-10">
        <h1 className="text-2xl font-semibold text-ink">Your dashboard</h1>
        <p className="mt-2 text-body">
          Your private journey will appear here after onboarding.
        </p>
      </Container>
    </main>
  );
}
