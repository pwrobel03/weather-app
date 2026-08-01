import { cn } from "@/lib/utils";

type TemperatureDisplayProps = {
  temperatureCelsius: number;
  className?: string;
};

/**
 * design.md: "Liczba temperatury — waga 200, tracking −0.045em, leading
 * 0.92." Stays in the platform sans font (not the monospace rule that
 * applies to other numeric data, e.g. hourly/daily figures) - this is the
 * hero number, not a table of figures. The °C suffix rides smaller and at
 * normal tracking so it doesn't inherit the big number's tight metrics.
 */
export function TemperatureDisplay({ temperatureCelsius, className }: TemperatureDisplayProps) {
  return (
    <p
      className={cn(
        "text-[4.5rem] font-extralight leading-[0.92] tracking-[-0.045em] tabular-nums",
        className,
      )}
    >
      {Math.round(temperatureCelsius)}
      <sup className="align-super text-[0.35em] font-light tracking-normal">°C</sup>
    </p>
  );
}
