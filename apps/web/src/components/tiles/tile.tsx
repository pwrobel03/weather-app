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
        "group/tile relative flex flex-col gap-3 py-4 sm:py-5 lg:gap-4 lg:p-6 lg:rounded-[2.25rem] transition-[transform,box-shadow,border-color,background-color] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        variant === "glass"
          ? "glass rounded-3xl p-5 lg:rounded-[2.25rem] lg:p-6 lg:hover:shadow-xl lg:hover:-translate-y-0.5"
          : "bg-transparent border-0 shadow-none lg:interactive-tile lg:border lg:border-border/70 lg:bg-gradient-to-br lg:from-card lg:via-card/95 lg:to-card/90 lg:text-card-foreground lg:shadow-md lg:backdrop-blur-xl lg:dark:border-white/10 lg:dark:from-[#171c28] lg:dark:via-[#131822] lg:dark:to-[#0e121a] lg:hover:border-white/20 lg:hover:shadow-xl",
        className,
      )}
    >
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 pb-1 px-1 lg:border-b lg:border-border/20 lg:pb-3">
          {title && (
            <h2 className="text-lg sm:text-xl lg:text-base xl:text-lg font-bold text-foreground tracking-tight opacity-95 group-hover/tile:opacity-100 transition-opacity">
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
