import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Header } from "@/components/Header";
import { themeScript } from "@/components/ThemeToggle";
import { AccountLayer } from "@/account/AccountLayer";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { WebVitals } from "@/components/WebVitals";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// One static weight: Unbounded is only used bold, and a single weight is ~21 KB
// against ~51 KB for the variable font (it sits on the LCP path for headings).
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: {
    default: "FPL Lineup — Fantasy Premier League planner",
    template: "%s · FPL Lineup",
  },
  description:
    "Plan your Fantasy Premier League team for every gameweek: transfers, subs, chips and projected points, instantly.",
  applicationName: "FPL Lineup",
  // Installed on iOS: full screen under a translucent status bar (the header pads for it).
  appleWebApp: { capable: true, title: "FPL Lineup", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // Matches the dark background (the default theme).
  themeColor: "#07040d",
  // Edge to edge, so the tab bar can float over the home indicator's safe area.
  viewportFit: "cover",
  // App-like: no pinch zoom, and no iOS zoom-in when focusing a small input.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${unbounded.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col pb-[calc(env(safe-area-inset-bottom)+5rem)]">
        <WebVitals />
        <PwaSetup />
        <AccountLayer />
        <Header />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4">{children}</main>
        <footer className="mx-auto w-full max-w-lg px-4 py-8 text-center text-[11px] leading-relaxed text-muted">
          FPL Lineup is an independent fan-made planner and is not affiliated with, or endorsed by, the
          Premier League or Fantasy Premier League.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
