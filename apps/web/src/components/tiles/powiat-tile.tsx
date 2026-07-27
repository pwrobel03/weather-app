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
    <Tile title={labels.title}>
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 100 100"
          className="size-24 shrink-0 text-[color-mix(in_srgb,var(--foreground)_22%,transparent)]"
          role="img"
          aria-label={`${outline.name}${severity ? ` — ${labels.covered}` : ""}`}
        >
          <path
            d={path}
            fill={fill}
            fillOpacity={severity ? 0.85 : 1}
            stroke="currentColor"
            strokeOpacity={severity ? 0.9 : 0.55}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>

        <div className="flex min-w-0 flex-col gap-1">
          <p className="on-glass truncate text-base font-semibold">{outline.name}</p>
          <p className="on-glass-muted truncate text-xs">{outline.voivodeship}</p>
          <p className="on-glass-muted font-mono text-xs tabular-nums">TERYT {outline.terytCode}</p>
          <p className={severity ? "on-glass text-xs font-semibold" : "on-glass-muted text-xs"}>
            {severity ? labels.covered : labels.clear}
          </p>
        </div>
      </div>
    </Tile>
  );
}
