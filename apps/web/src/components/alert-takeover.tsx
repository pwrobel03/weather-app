import {
  alertMessages,
  formatValidity,
  listFormat,
  type Locale,
} from "@/lib/i18n/messages";

export type WarningSeverityLevel = "1" | "2" | "3";

type AlertTakeoverProps = {
  severity: WarningSeverityLevel;
  /** IMGW's Polish event name, e.g. "Burze". */
  event: string;
  /** MeteoAlarm's English name, when the CAP enrichment reached us. */
  eventEn?: string | null;
  /** IMGW's free warning text. Stays Polish - see messages.ts. */
  content?: string | null;
  /** ISO-8601 instant. */
  validTo: string;
  affectedLocations: readonly string[];
  locale: Locale;
};

/**
 * The warning card shown once an alert has taken over the screen.
 *
 * Sits on an opaque material, never on glass: readability of a translucent
 * surface over a shifting gradient always breaks down, and this is the one
 * surface in the app that must stay legible (markdown/design.md).
 *
 * A Server Component - the takeover and its motion are entirely CSS, so this
 * ships no JavaScript. Faza 7 makes arrival live over the WebSocket; that
 * moves the trigger to the client, not this presentation.
 */
export function AlertTakeover({
  severity,
  event,
  eventEn,
  content,
  validTo,
  affectedLocations,
  locale,
}: AlertTakeoverProps) {
  const messages = alertMessages[locale];

  // Exactly why commit 46 pulled MeteoAlarm's CAP data: the English name is
  // supplied upstream, so no dictionary of Polish weather phenomena is needed.
  const eventName = locale === "en" && eventEn ? eventEn : event;

  return (
    <section
      className="alert-card"
      // Announced immediately: this is the one message in the app a screen
      // reader user must not have to go looking for.
      role="alert"
      aria-live="assertive"
    >
      <p className="alert-card__severity">{messages.severityLabel[severity]}</p>
      <h2 className="alert-card__event">{eventName}</h2>

      <dl className="alert-card__meta">
        <div>
          <dt>{messages.inForceUntil}</dt>
          <dd>
            <time dateTime={validTo}>{formatValidity(validTo, locale)}</time>
          </dd>
        </div>
        {affectedLocations.length > 0 && (
          <div>
            <dt>{messages.affects}</dt>
            <dd>{listFormat(affectedLocations, locale)}</dd>
          </div>
        )}
      </dl>

      {content && (
        <p className="alert-card__content" lang="pl">
          {content}
        </p>
      )}

      <p className="alert-card__source">
        {messages.source}
        {locale === "en" && content ? ` · ${messages.originalLanguageNote}` : ""}
      </p>
    </section>
  );
}
