/** Only Platform is reachable from the modules under test; the storage layer
 * branches on it to decide SecureStore versus localStorage. */
export const Platform = { OS: "ios" as const };
