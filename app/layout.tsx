import type { Metadata, Viewport } from "next";
import { PwaSupport } from '@/components/pwa-support'
import { Geist, Geist_Mono } from "next/font/google";
import { VisibilityProvider } from '@/context/visibility-context'
import "./globals.css";
import Script from 'next/script'
import { THEME_INIT_SCRIPT } from '@/lib/themes'
import { ActivityTracker } from '@/components/activity-tracker'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NoControle — Painel de despesas",
  description: "Organize despesas, faturas e orçamento em um só lugar.",
  applicationName: 'NoControle',
  appleWebApp: { capable: true, title: 'NoControle', statusBarStyle: 'default' },
  icons: { icon: { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }, apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#6750a4' };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans"><Script id="dashboard-theme" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script><PwaSupport /><ActivityTracker /><VisibilityProvider>{children}</VisibilityProvider></body>
    </html>
  );
}
