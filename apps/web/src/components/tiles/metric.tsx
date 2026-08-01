import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One reading: a small label and a large number.
 *
 * The scale is the point. A measurement of 149 elements on the home screen
 * found 129 of them between 10 and 16px - everything shouted in the same quiet
 * voice, so nothing led the eye. Values are now display-sized and labels drop
 * to 10px caps, which is the relationship every reference in idea/updated uses.
 */
export function Metric({
  icon,
  label,
  value,
  unit,
  size = "md",
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  unit?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueSize = {
    sm: "text-xl",
    md: "text-[1.75rem]",
    lg: "text-[2.25rem]",
  }[size];

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <dt
        className="flex items-center gap-1.5 text-[0.625rem] uppercase opacity-65"
        style={{ letterSpacing: "var(--dt-type-label-tracking)" }}
      >
        {icon}
        {label}
      </dt>
      <dd className={cn("font-mono leading-none font-light tabular-nums", valueSize)}>
        {value}
        {unit && <span className="ml-1 text-[0.5em] font-normal opacity-60">{unit}</span>}
      </dd>
    </div>
  );
}
