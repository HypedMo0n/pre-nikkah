import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";

import { brand } from "@/config/brand";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html dir="ltr" lang="en">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
