export type WarningSeverityLevel = "1" | "2" | "3";

type AlertLike = {
  id: number;
  event: string;
  severity: WarningSeverityLevel;
  terytCodes: string[];
};

export type PowiatAlertSummary = {
  id: number;
  event: string;
  severity: WarningSeverityLevel;
};

export type MapSeverity = {
  /** TERYT code -> the highest level in force there. */
  severityByTeryt: Record<string, WarningSeverityLevel>;
  /** TERYT code -> every warning covering it, in the order they arrived. */
  alertsByTeryt: Record<string, PowiatAlertSummary[]>;
  /** How many powiats sit at each level, for the legend. */
  countsByLevel: Record<WarningSeverityLevel, number>;
};

/**
 * Turns a list of warnings into what the map paints.
 *
 * A separate module rather than inline in the page because this is the part
 * that can actually be wrong, and it cannot be tested through the map itself -
 * MapLibre needs a WebGL context that jsdom does not have.
 */
export function resolveMapSeverity(alerts: readonly AlertLike[]): MapSeverity {
  const severityByTeryt: Record<string, WarningSeverityLevel> = {};
  const alertsByTeryt: Record<string, PowiatAlertSummary[]> = {};

  for (const alert of alerts) {
    for (const terytCode of alert.terytCodes) {
      const current = severityByTeryt[terytCode];
      // A powiat can sit under several warnings at once, and the map shows the
      // worst. Last-wins would let a level 1 issued later hide a level 3 still
      // in force - which is the one mistake this map must not make.
      if (!current || Number(alert.severity) > Number(current)) {
        severityByTeryt[terytCode] = alert.severity;
      }

      (alertsByTeryt[terytCode] ??= []).push({
        id: alert.id,
        event: alert.event,
        severity: alert.severity,
      });
    }
  }

  const countsByLevel: Record<WarningSeverityLevel, number> = { "1": 0, "2": 0, "3": 0 };
  for (const level of Object.values(severityByTeryt)) {
    countsByLevel[level] += 1;
  }

  return { severityByTeryt, alertsByTeryt, countsByLevel };
}
