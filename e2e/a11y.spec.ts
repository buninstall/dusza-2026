import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { login, openPlay, type Theme, useTheme } from "./helpers.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const BLOCKING = new Set(["serious", "critical"]);
const REACT_ARIA_ANNOUNCER = '[role="log"][aria-live="assertive"] > [role="img"]';

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude(REACT_ARIA_ANNOUNCER)
    .analyze();
  return results.violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ""))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

const THEMES: readonly Theme[] = ["tarna", "felszin"];

for (const theme of THEMES) {
  test.describe(`akadálymentesség (${theme} téma)`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test("bejelentkezés és regisztráció", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Bejelentkezés" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await blockingViolations(page)).toEqual([]);
      await page.goto("/register");
      await expect(page.getByRole("heading", { name: "Regisztráció" })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });

    test("térképlista", async ({ page }) => {
      await login(page);
      expect(await blockingViolations(page)).toEqual([]);
    });

    test("játék oldal", async ({ page }) => {
      await login(page);
      await openPlay(page, "3. Kis labirintus");
      expect(await blockingViolations(page)).toEqual([]);
    });

    test("térképszerkesztő", async ({ page }) => {
      await login(page);
      await page.getByRole("link", { name: "Új térkép" }).first().click();
      await expect(page.getByRole("grid", { name: "Térképrács" })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });

    test("ranglista", async ({ page }) => {
      await login(page);
      await page.getByRole("link", { name: "Ranglista: 1. Egyenes folyosó" }).click();
      await expect(page.getByRole("heading", { level: 1, name: /Ranglista/ })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });

    test("kézikönyv és futásnapló", async ({ page }) => {
      await login(page);
      await page.getByRole("link", { name: "Kézikönyv" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "A MineScript kézikönyve" }),
      ).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
      await page.getByRole("link", { name: "Futásaim" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Futásaim" })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });
  });
}
