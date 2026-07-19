import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";

import { brand } from "@/config/brand";
import { localeCookieName, parseLocale } from "@/lib/i18n/config";

import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

const fraunces = Fraunces({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-fraunces",
});

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
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
