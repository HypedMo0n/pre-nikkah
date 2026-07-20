import { notFound } from "next/navigation";

import { DemoNotice } from "@/components/demo/demo-notice";
import { PrivateTabs } from "@/components/layout/private-tabs";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function PrivateLocalizedLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAuthenticatedUser(locale);
  return (
    <div className="min-h-[100svh] bg-background">
      <DemoNotice locale={locale} />
      <PrivateTabs locale={locale} />
      {children}
    </div>
  );
}
