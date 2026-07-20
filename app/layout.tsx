import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";

import { brand } from "@/config/brand";
import { localeCookieName, parseLocale } from "@/lib/i18n/config";

import "./globals.css";

export const metadata: Metadata = {
  description: brand.shortDescription,
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(localeCookieName)?.value);

  return (
    <html dir="ltr" lang={locale}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
