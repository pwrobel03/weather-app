"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

const GlassSurfaceContext = createContext(false);

/**
 * design.md, Backlog 1: "nie wolno układać półprzezroczystej powierzchni na
 * drugiej takiej samej — czytelność się załamuje." This turns that hard
 * constraint into a dev-time warning instead of a silent visual bug.
 * Production builds are unaffected - the check only runs outside NODE_ENV
 * "production".
 */
export function GlassSurface({ active, children }: { active: boolean; children: ReactNode }) {
  const alreadyInsideGlass = useContext(GlassSurfaceContext);
  const warned = useRef(false);

  useEffect(() => {
    if (active && alreadyInsideGlass && !warned.current && process.env.NODE_ENV !== "production") {
      warned.current = true;
      console.warn(
        "[glass] Rendered a glass surface inside another glass surface. design.md forbids " +
          "stacking translucent materials — legibility collapses. Use an opaque surface " +
          "(e.g. the default variant) here instead.",
      );
    }
  }, [active, alreadyInsideGlass]);

  return (
    <GlassSurfaceContext.Provider value={active || alreadyInsideGlass}>
      {children}
    </GlassSurfaceContext.Provider>
  );
}
