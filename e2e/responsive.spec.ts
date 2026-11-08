import { expect, type Locator, type Page, test } from "@playwright/test";
import { editor, gotoLeaderboard, login, openPlay, replaceProgram } from "./helpers.ts";

const WIDTHS = [320, 768, 1024, 1440] as const;
const HEIGHT = 900;

async function noHorizontalOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
}

async function reachable(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  if (!box) throw new Error("Az elemnek nincs mérete.");
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  const covered = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit !== null && hit !== element && !element.contains(hit);
  });
  expect(covered).toBe(false);
}

for (const width of WIDTHS) {
  test.describe(`${width} px széles nézet`, () => {
    test.use({ viewport: { width, height: HEIGHT } });

    test("bejelentkezés: nincs vízszintes túlcsordulás, a belépés gomb elérhető", async ({
      page,
    }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Bejelentkezés" })).toBeVisible();
      await noHorizontalOverflow(page);
      await reachable(page, page.getByRole("button", { name: "Belépés" }));
    });

    test("térképlista: nincs túlcsordulás, a navigáció használható", async ({ page }) => {
      await login(page);
      await noHorizontalOverflow(page);
      await page.goto("/maps?mode=story");
      await noHorizontalOverflow(page);
      await reachable(page, page.getByRole("link", { name: "Játék: 1. Egyenes folyosó" }));
    });

    test("játék oldal: térkép, szerkesztő és vezérlők láthatók, nincs túlcsordulás", async ({
      page,
    }) => {
      await login(page);
      await openPlay(page, "1. Egyenes folyosó");
      await noHorizontalOverflow(page);
      await reachable(page, page.getByRole("grid", { name: "1. Egyenes folyosó térképe" }));
      await reachable(page, editor(page));
      await reachable(page, page.getByRole("button", { name: "Futtatás" }));
    });

    test("játék oldal: a futásidejű hiba látható, és nem tolja szét az elrendezést", async ({
      page,
    }) => {
      await login(page);
      await openPlay(page, "1. Egyenes folyosó");
      await replaceProgram(page, "print x\n");
      await page.getByRole("button", { name: "Futtatás" }).click();
      const status = page.getByRole("status").filter({ hasText: "E_UNINITIALIZED · 1. sor" });
      await expect(status.first()).toBeVisible();
      await noHorizontalOverflow(page);
    });

    test("ranglista: nincs túlcsordulás", async ({ page }) => {
      await login(page);
      await gotoLeaderboard(page, "1. Egyenes folyosó");
      await expect(page.getByRole("heading", { level: 1, name: /Ranglista/ })).toBeVisible();
      await noHorizontalOverflow(page);
    });

    test("térképszerkesztő: a rács látható, nincs túlcsordulás", async ({ page }) => {
      await login(page);
      await page.getByRole("link", { name: "Új térkép" }).first().click();
      const grid = page.getByRole("grid", { name: "Térképrács" });
      await expect(grid).toBeVisible();
      await noHorizontalOverflow(page);
    });
  });
}
