import { useEffect, useState } from "react";

/**
 * Trails a value by `delayMs`, so a search fires once the user stops typing.
 *
 * Mirrors apps/web/src/lib/use-debounced-value.ts. Not shared through
 * @weather-app/core because that package is deliberately React-free - a hook
 * would drag React into a dependency of the backend-facing types.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
