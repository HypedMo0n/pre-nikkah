import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, Inter } from "next/font/google";

import { brand } from "@/config/brand";
import { localeCookieName, parseLocale } from "@/lib/i18n/config";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  description: brand.shortDescription,
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
};

const analyticsEnabled = process.env.VERCEL === "1";

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
        {analyticsEnabled ? <Analytics /> : null}
      </body>
    </html>
  );
}
