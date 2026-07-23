import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { brand } from "@/config/brand";
import { localeCookieName, parseLocale } from "@/lib/i18n/config";

import "./globals.css";

// Variable names match the --font-fraunces/--font-inter custom properties
// already referenced throughout globals.css, so no other file needs to
// change. Weights are limited to what §8 actually specifies (Fraunces
// Light 300 for headlines, Regular 400 for questions/numerals/invite code;
// Inter Regular/Medium/SemiBold).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
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
    <html className={`${fraunces.variable} ${inter.variable}`} dir="ltr" lang={locale}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
