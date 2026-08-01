"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { savePreferencesAction, type PreferencesActionState } from "@/lib/user/actions";
import type { UserProfile } from "@/lib/user/api";

const LABELS = {
  temperature: "Temperatura",
  wind: "Prędkość wiatru",
  precipitation: "Opad",
  save: "Zapisz",
  saving: "Zapisywanie…",
  saved: "Zapisano",
};

const GROUPS = [
  {
    name: "temperatureUnit" as const,
    label: LABELS.temperature,
    options: [
      { value: "CELSIUS", label: "°C" },
      { value: "FAHRENHEIT", label: "°F" },
    ],
  },
  {
    name: "windSpeedUnit" as const,
    label: LABELS.wind,
    options: [
      { value: "KMH", label: "km/h" },
      { value: "MPH", label: "mph" },
    ],
  },
  {
    name: "precipitationUnit" as const,
    label: LABELS.precipitation,
    options: [
      { value: "MM", label: "mm" },
      { value: "IN", label: "in" },
    ],
  },
];

export function PreferencesForm({ profile }: { profile: UserProfile }) {
  const [state, formAction, pending] = useActionState<PreferencesActionState, FormData>(
    savePreferencesAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <fieldset key={group.name} className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{group.label}</legend>
          <div className="flex gap-2">
            {group.options.map((option) => (
              // Radios rather than a select: two options each, and a visible
              // pair states the choice without a click.
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10"
              >
                <input
                  type="radio"
                  name={group.name}
                  value={option.value}
                  defaultChecked={profile[group.name] === option.value}
                  className="accent-primary"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? LABELS.saving : LABELS.save}
        </Button>
        {state.saved && !pending && (
          <span className="text-sm text-muted-foreground" role="status">
            {LABELS.saved}
          </span>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
