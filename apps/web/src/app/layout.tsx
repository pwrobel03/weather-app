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
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
