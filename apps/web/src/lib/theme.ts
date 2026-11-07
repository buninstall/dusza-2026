export type Theme = "tarna";

export const THEME: Theme = "tarna";

const THEME_COLOR = "#110f0d";

export function applyTheme(theme: Theme = THEME): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR);
}
