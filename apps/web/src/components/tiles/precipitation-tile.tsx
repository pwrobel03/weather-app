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
      aside={
        <span className="on-glass font-mono text-sm tabular-nums">
          {peak}% <span className="on-glass-muted text-xs">{labels.peak}</span>
        </span>
      }
    >
      {peak === 0 ? (
        <p className="on-glass-muted text-sm">{labels.none}</p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-20 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${labels.title}: ${peak}% ${labels.peak}`}
        >
          <defs>
            <linearGradient id="precip-area" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={HEIGHT}>
              <stop offset="0%" stopColor="#7CC0F0" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#2E6FA8" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#precip-area)" />
          <path d={line} fill="none" stroke="#7CC0F0" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}

      <ol className="on-glass-muted flex justify-between font-mono text-[0.625rem] tabular-nums">
        {[window[0], window[Math.floor(window.length / 2)], window[window.length - 1]].map((entry) => (
          <li key={entry.time}>{formatHourMinute(entry.time)}</li>
        ))}
      </ol>
    </Tile>
  );
}
