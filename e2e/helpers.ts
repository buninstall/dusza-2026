import { expect, type Locator, type Page } from "@playwright/test";

export const DEMO = { username: "demo1", password: "demo2026" } as const;

export type Theme = "tarna" | "felszin";

export async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    (value) => window.localStorage.setItem("minescript.theme", value),
    theme,
  );
}

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Felhasználónév").fill(DEMO.username);
  await page.getByLabel("Jelszó").fill(DEMO.password);
  await page.getByRole("button", { name: "Belépés" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Térképek" })).toBeVisible();
}

export async function openPlay(page: Page, title: string): Promise<void> {
  await page.getByRole("link", { name: `Játék: ${title}` }).click();
  await expect(page).toHaveURL(/\/play\/\d+/);
  await expect(page.getByRole("grid", { name: `${title} térképe` })).toBeVisible();
}

export function editor(page: Page): Locator {
  return page.getByRole("textbox", { name: "MineScript program" });
}

export async function replaceProgram(page: Page, source: string): Promise<void> {
  const box = editor(page);
  await box.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  if (source.length > 0) {
    await page.keyboard.insertText(source);
  }
  await expect(box).toHaveText(source.replaceAll("\n", ""));
}

export async function runProgram(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expect(page.getByText("Fut", { exact: true })).toBeVisible();
}

export async function tabUntil(
  page: Page,
  matches: () => Promise<boolean>,
  maxPresses = 80,
): Promise<void> {
  for (let press = 0; press < maxPresses; press += 1) {
    if (await matches()) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("A keresett elem billentyűzettel nem érhető el.");
}

export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element) {
      return "";
    }
    return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();
  });
}
