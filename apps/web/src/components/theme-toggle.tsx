"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

/**
 * resolvedTheme is undefined until after mount (it depends on the OS
 * preference / localStorage, neither available during SSR) - rendering a
 * fixed icon until then avoids a hydration mismatch. useSyncExternalStore
 * (not useState+useEffect) so the mount flip doesn't trip the "setState in
 * an effect" lint rule - there's no external store here, just a way to ask
 * "are we past hydration yet" without an imperative effect.
 */
function useHasMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Two-way toggle (light/dark), not a three-way system/light/dark picker -
 * defaultTheme="system" (ThemeProvider) already covers "follow the OS" as
 * the starting point; this is for the user who wants to override it.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="glass"
      size="icon"
      aria-label={isDark ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
