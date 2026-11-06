import { expect, type Page } from "@playwright/test";

export const DEMO = { username: "demo1", password: "demo2026" } as const;

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Felhasználónév").fill(DEMO.username);
  await page.getByLabel("Jelszó").fill(DEMO.password);
  await page.getByRole("button", { name: "Belépés" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Térképek" })).toBeVisible();
}

export async function tabUntil(
  page: Page,
  matches: () => Promise<boolean>,
  maxPresses = 60,
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
