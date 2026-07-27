import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TileProps = {
  title?: string;
  /** Shown right of the title - a count, a unit, a link. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * A bento cell (design.md §6).
 *
 * Glass, because every surface outside the hero and the alert card is glass.
 * Never contains another Tile: stacking translucent surfaces collapses
 * legibility, which GlassSurface warns about at dev time.
 */
export function Tile({ title, aside, className, children }: TileProps) {
  return (
    <section className={cn("glass flex flex-col gap-3 rounded-3xl p-5", className)}>
      {(title || aside) && (
        <header className="flex items-baseline justify-between gap-3">
          {title && (
            <h2
              className="on-glass-muted text-[0.8125rem] uppercase"
              style={{ letterSpacing: "var(--dt-type-heading-tracking)" }}
            >
              {title}
            </h2>
          )}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}
