import { readStorage, writeStorage } from "./storage.ts";

export type Theme = "tarna" | "felszin";

export const THEME_KEY = "minescript.theme";
export const DEFAULT_THEME: Theme = "tarna";

const THEME_COLORS: Record<Theme, string> = { tarna: "#110f0d", felszin: "#e6d9c0" };

export function isTheme(value: unknown): value is Theme {
  return value === "tarna" || value === "felszin";
}

export function initialTheme(): Theme {
  const stored = readStorage(THEME_KEY);
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme);
  writeStorage(THEME_KEY, theme);
}

export function nextTheme(theme: Theme): Theme {
  return theme === "tarna" ? "felszin" : "tarna";
}
