import { readStorage, writeStorage } from "./storage.ts";

export type Theme = "light" | "dark";

const THEME_KEY = "minescript.theme";

export function initialTheme(): Theme {
  const stored = readStorage(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  writeStorage(THEME_KEY, theme);
}
