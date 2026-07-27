import { Tile } from "@/components/tiles/tile";
import type { Locale } from "@/lib/i18n/messages";
import { outlineToSvgPath, type PowiatOutline } from "@/lib/weather/boundary";

const LABELS: Record<Locale, { title: string; covered: string; clear: string }> = {
  pl: { title: "Twój powiat", covered: "Objęty ostrzeżeniem", clear: "Bez ostrzeżeń" },
  en: { title: "Your county", covered: "Covered by a warning", clear: "No warnings" },
};

/**
 * The outline of the powiat the active location sits in, filled when a warning
 * covers it.
 *
 * This is the shape the whole backend was built around: IMGW publishes warning
 * areas as powiat codes and nothing else, so "am I inside it" is a question
 * about this outline. The boundary endpoints have existed since Faza 2 with no
 * consumer.
 *
 * Fill uses the severity colour, which is a *signal* here rather than
 * depiction - so it is paired with a text label, never left to carry the
 * meaning alone (design.md §3).
 */
export function PowiatTile({
  outline,
  severity,
  locale,
}: {
  outline: PowiatOutline;
  /** IMGW level of the warning covering this powiat, if any. */
  severity?: "1" | "2" | "3" | null;
  locale: Locale;
}) {
  const labels = LABELS[locale];
  const path = outlineToSvgPath(outline.geometry);
  const fill = severity ? `var(--dt-color-warning-${severity})` : "currentColor";

  return (
    <Tile title={labels.title} className="h-full">
      <div className="flex h-full items-center gap-5 p-1">
        <div className="relative shrink-0 flex items-center justify-center transition-transform duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-110 hover:rotate-2">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-90 pointer-events-none" />
          <svg
            viewBox="0 0 100 100"
            className="relative size-24 md:size-28 shrink-0 drop-shadow-md text-muted-foreground/35"
            role="img"
            aria-label={`${outline.name}${severity ? ` — ${labels.covered}` : ""}`}
          >
            <path
              d={path}
              fill={fill}
              fillOpacity={severity ? 0.85 : 0.15}
              stroke="currentColor"
              strokeOpacity={severity ? 0.9 : 0.7}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div>
            <p className="truncate text-lg font-bold tracking-tight text-foreground">{outline.name}</p>
            <p className="truncate text-xs font-medium text-muted-foreground/90 uppercase tracking-wide">{outline.voivodeship}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-muted-foreground border border-border/50 tabular-nums">
              TERYT {outline.terytCode}
            </span>
          </div>
          <p className={`text-xs font-semibold mt-0.5 ${
            severity ? "text-destructive font-bold" : "text-emerald-500 dark:text-emerald-400"
          }`}>
            {severity ? labels.covered : `✓ ${labels.clear}`}
          </p>
        </div>
      </div>
    </Tile>
  );
}
