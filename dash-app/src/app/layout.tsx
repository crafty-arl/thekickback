import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { SandboxBanner } from "@/components/sandbox-banner";
import Script from "next/script";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "theKickBack — Dashboard",
  description: "Manage your place, view live sessions, and handle visitor requests.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KickBack Dash",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} font-sans`}>
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="antialiased">
        <SandboxBanner />
        {children}
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'})}`}
        </Script>
      </body>
    </html>
  );
}
