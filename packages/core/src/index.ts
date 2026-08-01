/**
 * Everything both clients need and neither owns.
 *
 * The rule for what belongs here: it must be pure TypeScript with no DOM, no
 * React, and no platform API. Rendering differs between a Next.js Server
 * Component and a React Native view, but "which phrase describes WMO code 95"
 * and "what does a level-2 warning read as in English" do not - and two
 * answers to those questions is one answer too many.
 *
 * The fetchers stay out deliberately: each app configures its own base URL and
 * auth transport (cookies on web, SecureStore on mobile), so only the response
 * *types* are shared - see ./weather/forecast.
 */
export * from "./i18n/alert-ui";
export * from "./i18n/app";
export * from "./i18n/auth";
export * from "./i18n/messages";
export * from "./weather/channels";
export * from "./weather/condition";
export * from "./weather/forecast";
export * from "./weather/naive-time";
export * from "./weather/projection";
export * from "./weather/scene";
