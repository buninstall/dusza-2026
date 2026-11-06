import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { login } from "./helpers.ts";

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

for (const scheme of ["light", "dark"] as const) {
  test.describe(`akadálymentesség (${scheme} téma)`, () => {
    test.use({ colorScheme: scheme });

    test("bejelentkezés", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Bejelentkezés" })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });

    test("térképlista", async ({ page }) => {
      await login(page);
      expect(await blockingViolations(page)).toEqual([]);
    });

    test("játék oldal", async ({ page }) => {
      await login(page);
      await page.getByRole("link", { name: "Játék: 3. Kis labirintus" }).click();
      await expect(page.getByRole("grid", { name: /térképe$/ })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });
  });
}
