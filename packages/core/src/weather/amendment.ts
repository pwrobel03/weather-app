import type { components } from "@weather-app/api-client";

import type { Locale } from "@weather-app/contract";

export type AlertRevision = components["schemas"]["AlertRevision"];

/**
 * What IMGW changed, as one sentence.
 *
 * The history endpoint returns every state a warning has been in. A reader
 * standing in the rain does not want a changelog - they want to know whether
 * this got worse and whether it now lasts longer. So only the most recent
 * amendment is described, and only along the two axes that change plans.
 *
 * Severity leads whenever it moved. A storm going from level 2 to level 3 is a
 * different statement about the day, and burying it under a timestamp would be
 * the same mistake as reporting the level by colour alone.
 */
export type Amendment = {
  /** True when the level went up - the case worth drawing attention to. */
  escalated: boolean;
  text: string;
};

type AmendmentSubject = {
  severity: "1" | "2" | "3";
  validTo: string;
};

const MESSAGES: Record<
  Locale,
  {
    raised: (from: string, to: string) => string;
    lowered: (from: string, to: string) => string;
    extended: (until: string) => string;
    shortened: (until: string) => string;
    updated: string;
    at: (time: string) => string;
  }
> = {
  pl: {
    raised: (from, to) => `Podniesione z ${from}. na ${to}. stopień`,
    lowered: (from, to) => `Obniżone z ${from}. na ${to}. stopień`,
    extended: (until) => `Przedłużone do ${until}`,
    shortened: (until) => `Skrócone do ${until}`,
    updated: "Zaktualizowane przez IMGW",
    at: (time) => ` o ${time}`,
  },
  en: {
    raised: (from, to) => `Raised from level ${from} to level ${to}`,
    lowered: (from, to) => `Lowered from level ${from} to level ${to}`,
    extended: (until) => `Extended until ${until}`,
    shortened: (until) => `Shortened to ${until}`,
    updated: "Updated by IMGW",
    at: (time) => ` at ${time}`,
  },
};

/**
 * Describes the latest amendment, or nothing if there has never been one.
 *
 * Nothing is the common answer: most warnings are issued once and expire
 * unchanged. A component rendering this should disappear rather than announce
 * that nothing happened.
 */
export function describeAmendment(
  revisions: AlertRevision[],
  current: AmendmentSubject,
  locale: Locale,
  formatTime: (isoTimestamp: string) => string,
): Amendment | null {
  const previous = revisions[revisions.length - 1];
  if (!previous) return null;

  const messages = MESSAGES[locale];
  const at = messages.at(formatTime(previous.recordedAt));

  if (previous.severity !== current.severity) {
    // String comparison, as everywhere else this scale is handled: '1' to '3'
    // order the same lexically as numerically, and this avoids a second place
    // that has to agree about which direction the scale runs.
    const escalated = current.severity > previous.severity;
    const phrase = escalated ? messages.raised : messages.lowered;

    return { escalated, text: phrase(previous.severity, current.severity) + at };
  }

  if (previous.validTo !== current.validTo) {
    const longer = current.validTo > previous.validTo;
    const phrase = longer ? messages.extended : messages.shortened;

    // Not an escalation even when it lasts longer: the danger did not get
    // worse, and reserving the emphasis for severity keeps it meaning one
    // thing.
    return { escalated: false, text: phrase(formatTime(current.validTo)) + at };
  }

  // Content or wording changed. Worth saying that something did, not worth
  // quoting - IMGW's free text is a paragraph, and a diff of it on a phone is
  // noise.
  return { escalated: false, text: messages.updated + at };
}
