import { alertMessages, alertUiMessages, type Locale } from "@weather-app/core";

const LEVELS = ["3", "2", "1"] as const;

/**
 * The severity key.
 *
 * Built so it still works for a reader who cannot separate the three IMGW
 * hues, which is the whole reason a legend exists on a map that encodes its
 * one meaning in colour. Three things carry the level, and any one of them is
 * enough: the numeral inside the swatch, the level written out in words, and
 * the order - always 3, 2, 1 downward, so position alone is informative.
 *
 * Levels with nothing in force are dimmed rather than dropped. A key that
 * changes shape as warnings come and go stops being a key, and "no level 3
 * anywhere" is itself worth being able to read at a glance.
 */
export function MapLegend({
  locale,
  countsByLevel,
}: {
  locale: Locale;
  /** How many powiats sit at each level right now. */
  countsByLevel: Record<"1" | "2" | "3", number>;
}) {
  const messages = alertMessages[locale];
  const labels = alertUiMessages[locale];

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-md backdrop-blur-sm">
      <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {labels.warnings}
      </p>

      <ul className="flex flex-col gap-1.5">
        {LEVELS.map((level) => {
          const count = countsByLevel[level];
          return (
            <li
              key={level}
              className="flex items-center gap-2 text-xs"
              style={{ opacity: count === 0 ? 0.45 : 1 }}
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-bold text-black/80"
                style={{ background: `var(--dt-color-warning-${level})` }}
              >
                {level}
              </span>
              <span className="font-medium text-foreground">{messages.severityLabel[level]}</span>
              <span className="ml-auto pl-2 font-mono tabular-nums text-muted-foreground">
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
