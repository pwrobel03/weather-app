import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TileProps = {
  title?: string;
  /** Glass is opt-in, not the default - see the note on the component. */
  variant?: "matte" | "glass";
  /** Shown right of the title - a count, a unit, a link. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * A bento cell (design.md §6).
 *
 * Matte by default. The liquid-glass skill names "applying glass to every view"
 * as an anti-pattern - glass is for interactive elements, toolbars and cards -
 * and with thirteen glass surfaces on one screen the material had become
 * wallpaper. It is reserved now for the hero strip, buttons and the warnings
 * tile, where `variant="glass"` opts in.
 *
 * Never contains another Tile: stacking translucent surfaces collapses
 * legibility, which GlassSurface warns about at dev time.
 */
export function Tile({ title, aside, className, variant = "matte", children }: TileProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-3xl p-5",
        variant === "glass"
          ? "glass"
          : "border border-border/60 bg-card/85 text-card-foreground shadow-sm",
        className,
      )}
    >
      {(title || aside) && (
        <header className="flex items-baseline justify-between gap-3">
          {title && (
            <h2
              className="text-[0.6875rem] uppercase opacity-55"
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
