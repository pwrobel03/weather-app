import { Tile } from "@/components/tiles/tile";
import type { Locale } from "@/lib/i18n/messages";
import type { HourlyForecastEntry } from "@/lib/weather/hourly-forecast";
import { formatHourMinute } from "@/lib/weather/naive-time";

const HOURS = 12;
const WIDTH = 240;
const HEIGHT = 64;

const LABELS: Record<Locale, { title: string; none: string; peak: string }> = {
  pl: { title: "Szansa opadu", none: "Bez opadów w najbliższych godzinach", peak: "szczyt" },
  en: { title: "Chance of rain", none: "No rain expected in the coming hours", peak: "peak" },
};

/**
 * Twelve-hour precipitation probability.
 *
 * "Do I need an umbrella" is the question a weather app is opened for most
 * often, and it is the one thing neither the big number nor the icon answers.
 *
 * Drawn as an area rather than bars: probability is a continuous curve through
 * time, and bars would imply buckets that the data does not have. The series
 * is blue, not the warning scale - a chart series signals state, and design.md
 * §3 reserves those colours for exactly that.
 */
export function PrecipitationTile({
  entries,
  locale,
}: {
  entries: HourlyForecastEntry[];
  locale: Locale;
}) {
  const labels = LABELS[locale];
  const window = entries.slice(0, HOURS);

  if (window.length === 0) {
    return null;
  }

  const peak = Math.max(...window.map((entry) => entry.precipitationProbabilityPercent));

  const step = WIDTH / Math.max(window.length - 1, 1);
  const points = window.map((entry, index) => {
    const x = index * step;
    const y = HEIGHT - (entry.precipitationProbabilityPercent / 100) * HEIGHT;
    return { x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join("");
  const area = `${line}L${WIDTH} ${HEIGHT}L0 ${HEIGHT}Z`;

  return (
    <Tile
      title={labels.title}
      className="h-full flex flex-col justify-between"
      aside={
        <span className="on-glass inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-sky-500 dark:text-sky-400 ring-1 ring-sky-500/20">
          <span className="size-1.5 rounded-full bg-sky-400 animate-pulse-subtle" aria-hidden="true" />
          {peak}% <span className="text-[0.65rem] uppercase tracking-wide opacity-80">{labels.peak}</span>
        </span>
      }
    >
      <div className="flex flex-1 flex-col justify-center py-2">
        {peak === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground opacity-85">
            <span className="text-sm font-semibold tracking-wide">{labels.none}</span>
            <span className="text-[0.7rem] uppercase tracking-wider text-emerald-500 dark:text-emerald-400 font-bold">Status: Czyste Niebo</span>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-xl pt-2">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-28 w-full overflow-visible drop-shadow-[0_4px_12px_rgba(56,189,248,0.35)]"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${labels.title}: ${peak}% ${labels.peak}`}
            >
              <defs>
                <linearGradient id="precip-area" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={HEIGHT}>
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#precip-area)" />
              <path d={line} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )}
      </div>

      <ol className="mt-auto flex justify-between border-t border-border/30 pt-2 font-mono text-[0.7rem] font-medium tabular-nums text-muted-foreground">
        {[window[0], window[Math.floor(window.length / 2)], window[window.length - 1]].map((entry, idx) => (
          <li key={entry?.time || idx}>{entry ? formatHourMinute(entry.time) : ""}</li>
        ))}
      </ol>
    </Tile>
  );
}
