"use client";

import { appMessages, LOCALES, type Locale } from "@weather-app/core";
import { useTransition } from "react";

import { setLocaleAction } from "@/lib/locale-actions";

/**
 * The language, switchable.
 *
 * Mobile has had this since 99c; web read DEFAULT_LOCALE on every screen, so
 * the catalogue's English half existed and was unreachable. This is the whole
 * of what commits 110 and 111 were meant to deliver - the scaffolding they
 * called for turned out to be a fourth system over a catalogue that already
 * works on both clients.
 *
 * Each language is named in itself. "Polish" is unreadable to the person who
 * needs to click it.
 */
export function LanguageToggle({ locale }: { locale: Locale }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label={appMessages[locale].language}
      className="inline-flex rounded-full bg-white/10 p-0.5"
    >
      {LOCALES.map((option) => {
        const selected = option === locale;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={isPending}
            onClick={() => startTransition(() => setLocaleAction(option))}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              selected ? "bg-white/90 text-slate-900" : "text-white/70 hover:text-white"
            }`}
          >
            {/* Upper-cased for the chip, but only visually - the accessible
                name stays the endonym rather than two shouted letters. */}
            <span aria-hidden="true">{option.toUpperCase()}</span>
            <span className="sr-only">{appMessages[option].languageNames[option]}</span>
          </button>
        );
      })}
    </div>
  );
}
