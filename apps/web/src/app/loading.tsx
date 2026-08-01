import { Skeleton } from "@/components/skeleton";

/**
 * The home screen's shape while its data is in flight.
 *
 * The page is a Server Component that awaits the forecast, so without this the
 * browser holds the previous screen and then swaps the whole thing at once -
 * which reads as a frozen tab, not as loading.
 *
 * Proportions follow the real layout: a hero at 62% of the viewport (design.md
 * §6) with the tiles beneath it. Getting them wrong would replace one jump with
 * two - the skeleton settling, then the content settling somewhere else.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex w-full flex-col gap-6">
      {/* The label a screen reader gets instead of the boxes below. */}
      <span className="sr-only">Ładowanie prognozy</span>

      <Skeleton className="h-[62vh] min-h-[440px] w-full rounded-b-[2.5rem]" />

      <div className="flex flex-col gap-6 px-4 sm:px-0">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-28" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-32 w-[5.25rem] shrink-0 rounded-[2rem]" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
