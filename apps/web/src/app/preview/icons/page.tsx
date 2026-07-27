import { notFound } from "next/navigation";

import { WeatherArt } from "@/components/weather-art/weather-art";
import type { TimeOfDay } from "@/lib/weather/channels";

/**
 * Inspection surface for the weather icon set, alongside /preview/alert.
 *
 * Every WMO code the app maps, at both day and night, on both a light and a
 * dark ground. Icons are judged as a set or not at all - a cloud that looks
 * right on its own but heavier than the storm cloud beside it is a bug you
 * only see side by side.
 */
export const dynamic = "force-dynamic";

const CODES: readonly { code: number; label: string }[] = [
  { code: 0, label: "0 · bezchmurnie" },
  { code: 1, label: "1 · przeważnie bezchmurnie" },
  { code: 2, label: "2 · częściowe zachmurzenie" },
  { code: 3, label: "3 · zachmurzenie całkowite" },
  { code: 45, label: "45 · mgła" },
  { code: 51, label: "51 · mżawka" },
  { code: 61, label: "61 · deszcz słaby" },
  { code: 65, label: "65 · deszcz silny" },
  { code: 71, label: "71 · śnieg słaby" },
  { code: 75, label: "75 · śnieg silny" },
  { code: 80, label: "80 · przelotny deszcz" },
  { code: 95, label: "95 · burza" },
  { code: 96, label: "96 · burza z gradem" },
];

const TIMES: readonly TimeOfDay[] = ["day", "night"];

export default function IconPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-px">
      {(["#0B0E14", "#EEF2F7"] as const).map((ground) => (
        <section key={ground} className="flex-1 p-8" style={{ background: ground }}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-6">
            {CODES.flatMap(({ code, label }) =>
              TIMES.map((timeOfDay) => (
                <figure key={`${code}-${timeOfDay}`} className="flex flex-col items-center gap-2">
                  <WeatherArt code={code} timeOfDay={timeOfDay} className="size-20" />
                  <figcaption
                    className="text-center text-[0.6875rem] tracking-[0.04em]"
                    style={{ color: ground === "#0B0E14" ? "#8A94A6" : "#5B6472" }}
                  >
                    {label}
                    <br />
                    {timeOfDay}
                  </figcaption>
                </figure>
              )),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
