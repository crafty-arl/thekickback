import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Script from "next/script";
import { SandboxBanner } from "@/components/sandbox-banner";
import { PwaInstallPrompt } from "@/components/pwa-prompt";
import { ForceRefresh } from "@/components/force-refresh";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "theKickBack — Discover what's happening right now",
  description: "Tap into any venue. No app needed.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/logo.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "theKickBack",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="kb-build" content={process.env.NEXT_PUBLIC_APP_VERSION || "dev"} />
      </head>
      <body className={`${dmSans.variable} ${fraunces.variable} antialiased`}>
        <SandboxBanner />
        {children}
        <PwaInstallPrompt />
        <ForceRefresh />
        <Script id="sw-cleanup" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister()})});if('caches' in window){caches.keys().then(function(keys){keys.forEach(function(k){caches.delete(k)})})}}`}
        </Script>
      </body>
    </html>
  );
}
