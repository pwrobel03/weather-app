"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Class-based toggling (attribute="class") to match the `.dark` selector
 * already in globals.css (design.md's dark theme has been there since
 * commit 9). defaultTheme="system" respects the OS preference until the
 * user overrides it via ThemeToggle.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}
