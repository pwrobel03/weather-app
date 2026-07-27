import { notFound } from "next/navigation";

import { AlertTakeover, type WarningSeverityLevel } from "@/components/alert-takeover";
import { WeatherBackground } from "@/components/weather-background";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@weather-app/core";

/**
 * Inspection surface for the alert takeover, replacing
 * prototype/alert-layer.html.
 *
 * design.md keeps a prototype specifically so the alert states can be judged
 * side by side; moving the layer into production must not cost that. Reachable
 * only outside production - it renders fabricated warnings, and a fabricated
 * warning on a real deployment is exactly the thing this app must never show.
 */
export const dynamic = "force-dynamic";

const SEVERITIES: readonly WarningSeverityLevel[] = ["1", "2", "3"];

/**
 * Fixed rather than computed from the clock: the React Compiler rejects impure
 * calls during render, and a preview whose output changes every second is
 * useless for judging a design against yesterday's screenshot.
 */
const SAMPLE_VALID_TO = "2026-07-27T04:45:00.000Z";

const SAMPLE = {
  event: "Burze z gradem",
  eventEn: "Thunderstorms with hail",
  content:
    "Prognozowane są burze, którym miejscami będą towarzyszyć silne opady deszczu od 20 mm do 30 mm oraz porywy wiatru do 85 km/h. Lokalnie grad.",
  affectedLocations: ["Warszawa", "Pruszków"],
};

export default async function AlertPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { locale: requested } = await searchParams;
  const locale: Locale = LOCALES.includes(requested as Locale)
    ? (requested as Locale)
    : DEFAULT_LOCALE;

  return (
    <div className="flex flex-1 flex-col">
      {SEVERITIES.map((severity) => (
        <WeatherBackground
          key={severity}
          weatherCode={95}
          temperatureCelsius={24}
          alertSeverity={severity}
        >
          <main className="flex flex-1 items-center justify-center p-8">
            <AlertTakeover
              severity={severity}
              event={SAMPLE.event}
              eventEn={SAMPLE.eventEn}
              content={SAMPLE.content}
              validTo={SAMPLE_VALID_TO}
              affectedLocations={SAMPLE.affectedLocations}
              locale={locale}
            />
          </main>
        </WeatherBackground>
      ))}
    </div>
  );
}
