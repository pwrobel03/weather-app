/** No Expo dev server in a test run, so the API base URL falls back to
 * localhost - which is exactly what the mocked fetch expects. */
export default { expoConfig: null, easConfig: null };
