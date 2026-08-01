import type { components } from "@weather-app/api-client";

/**
 * Forecast response shapes, named once.
 *
 * These are aliases over the generated OpenAPI schema rather than hand-written
 * types, so a backend field rename fails the typecheck in both apps at the
 * same time instead of drifting in one of them.
 */
export type CurrentConditions = components["schemas"]["CurrentConditions"];
export type HourlyForecastEntry = components["schemas"]["HourlyForecastEntry"];
export type DailyForecastEntry = components["schemas"]["DailyForecastEntry"];
