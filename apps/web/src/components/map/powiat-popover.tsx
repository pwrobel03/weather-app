import { alertMessages, alertUiMessages, type Locale } from "@weather-app/core";
import Link from "next/link";

export type PowiatAlertSummary = {
  id: number;
  event: string;
  severity: "1" | "2" | "3";
};

/**
 * What one powiat has in force, anchored to where it was clicked.
 *
 * A summary rather than the warning itself: the map's job is "which places",
 * and IMGW's full text belongs on the detail screen that already renders it
 * with its source and its untranslated-original note. Each entry links there.
 *
 * Rendered as React over the canvas rather than through MapLibre's own Popup,
 * so the links are real Next.js links - a MapLibre popup takes an HTML string,
 * which means a full page load for what is a client-side navigation.
 */
export function PowiatPopover({
  name,
  voivodeship,
  alerts,
  locale,
  x,
  y,
  onClose,
}: {
  name: string;
  voivodeship: string;
  alerts: PowiatAlertSummary[];
  locale: Locale;
  /** Position in map-container pixels. */
  x: number;
  y: number;
  onClose: () => void;
}) {
  const messages = alertMessages[locale];
  const labels = alertUiMessages[locale];

  return (
    <div
      className="absolute z-20 w-64 -translate-x-1/2 -translate-y-full rounded-2xl border border-border/60 bg-card p-3 shadow-lg"
      // Offset upward so the card sits above the click rather than under the
      // cursor, which would cover the shape being asked about.
      style={{ left: x, top: y - 12 }}
      role="dialog"
      aria-label={name}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-[0.7rem] text-muted-foreground">{voivodeship}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.expired}
          className="-mr-1 -mt-1 rounded-md px-1.5 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>

      {alerts.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{labels.noActiveWarnings}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                href={`/alerts/${alert.id}`}
                className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--dt-color-warning-${alert.severity})` }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {alert.event}
                  </span>
                  {/* Never colour alone (design.md §3) - the dot above is an
                      extra, the words are the message. */}
                  <span className="block text-[0.7rem] text-muted-foreground">
                    {messages.severityLabel[alert.severity]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
