/**
 * A placeholder shaped like the thing that is coming.
 *
 * Shaped, not generic: a spinner says "wait" and nothing else, while a block
 * the size of the hero says what is about to appear and stops the page jumping
 * when it does. The layout is the information here, so these are laid out by
 * the caller rather than by a component that guesses.
 *
 * The pulse is a Tailwind animation, which means `prefers-reduced-motion` is
 * honoured by the stylesheet in globals.css rather than by a check here.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      // Hidden from the accessibility tree: a screen reader announcing six
      // empty boxes is worse than silence, and the region's own aria-busy is
      // what carries "this is loading".
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-muted ${className}`}
    />
  );
}
