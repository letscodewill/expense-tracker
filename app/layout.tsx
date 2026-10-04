import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { VisibilityProvider } from '@/context/visibility-context'
import "./globals.css";
import Script from 'next/script'
import { THEME_INIT_SCRIPT } from '@/lib/themes'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Track your expenses with ease",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans"><Script id="dashboard-theme" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script><VisibilityProvider>{children}</VisibilityProvider></body>
    </html>
  );
}
