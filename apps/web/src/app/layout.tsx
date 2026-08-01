import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { OfflineBanner } from "@/components/offline-banner";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { WeatherArtGradients } from "@/components/weather-art/gradients";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Weather App",
  description: "Prognoza i ostrzeżenia pogodowe dla Polski",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Every weather-icon gradient, defined once for the whole document.
            Inlining them per icon would duplicate ids the moment two icons
            share a screen. */}
        <WeatherArtGradients />
        {/* Above the providers: it has to be reachable on a page served from
            disk, where nothing behind it may have data to render. */}
        <OfflineBanner />

        {/* First stop in the tab order, invisible until focused. Without it a
            keyboard reaches the forecast only after every control in the
            header - on a page whose point is the forecast. */}
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold"
        >
          Przejdź do treści
        </a>

        <ThemeProvider>
          <QueryProvider>
            <div id="main">{children}</div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
