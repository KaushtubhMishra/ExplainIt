"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const THEME_LABEL: Record<string, string> = { auto: "Auto theme", sky: "Sky", forest: "Forest", sunset: "Sunset", night: "Night" };

type Ctx = { theme: string; setTheme: (theme: string) => void };
const ProjectThemeContext = createContext<Ctx | null>(null);

// Wraps a project page so its theme chip and the storyboard can share one value: a change
// request that switches the theme updates this directly, instead of reloading the page
// (which would otherwise force the storyboard to remount and lose its local state).
export function ProjectThemeProvider({ initialTheme, children }: { initialTheme: string; children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);
  return <ProjectThemeContext.Provider value={{ theme, setTheme }}>{children}</ProjectThemeContext.Provider>;
}

export function useProjectTheme(): Ctx {
  const ctx = useContext(ProjectThemeContext);
  if (!ctx) throw new Error("useProjectTheme must be used inside a ProjectThemeProvider");
  return ctx;
}

export function ThemeChip() {
  const { theme } = useProjectTheme();
  return <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-navy">{THEME_LABEL[theme] ?? theme}</span>;
}
