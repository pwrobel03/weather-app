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
        "group/tile relative flex flex-col gap-4 rounded-[2.25rem] p-5.5 md:p-6 transition-[transform,box-shadow,border-color,background-color] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        variant === "glass"
          ? "glass hover:shadow-xl hover:-translate-y-0.5"
          : "interactive-tile border border-border/70 bg-gradient-to-br from-card via-card/95 to-card/90 text-card-foreground shadow-md backdrop-blur-xl dark:border-white/10 dark:from-[#171c28] dark:via-[#131822] dark:to-[#0e121a] hover:border-white/20 hover:shadow-xl",
        className,
      )}
    >
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/20 pb-3 px-1">
          {title && (
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight opacity-95 group-hover/tile:opacity-100 transition-opacity">
              {title}
            </h2>
          )}
          <div className="text-right">{aside}</div>
        </header>
      )}
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </section>
  );
}
