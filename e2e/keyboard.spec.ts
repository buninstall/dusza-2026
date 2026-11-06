import { expect, test } from "@playwright/test";
import { DEMO, editor, focusedName, tabUntil } from "./helpers.ts";

test("bejelentkezés, játék és kijelentkezés csak billentyűzettel", async ({ page }) => {
  await page.goto("/login");
  await tabUntil(page, async () =>
    page.getByLabel("Felhasználónév").evaluate((element) => element === document.activeElement),
  );
  await page.keyboard.type(DEMO.username);
  await page.keyboard.press("Tab");
  await page.keyboard.type(DEMO.password);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Térképek" })).toBeVisible();

  await tabUntil(page, async () => (await focusedName(page)) === "Játék: 2. Az első kanyar");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/play\/\d+/);

  await tabUntil(page, async () =>
    editor(page).evaluate((element) => element === document.activeElement),
  );
  await page.keyboard.press("Tab");
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editor(page)).not.toBeFocused();

  const grid = page.getByRole("grid", { name: /térképe$/ });
  await tabUntil(page, async () =>
    grid.evaluate((element) => element.contains(document.activeElement)),
  );
  expect(await focusedName(page)).toMatch(/^1\. sor, 1\. oszlop/);
  await page.keyboard.press("ArrowRight");
  expect(await focusedName(page)).toMatch(/^1\. sor, 2\. oszlop/);
  await page.keyboard.press("Control+End");
  expect(await focusedName(page)).toMatch(/^4\. sor, 6\. oszlop/);

  await tabUntil(page, async () => (await focusedName(page)).startsWith("Felhasználói menü"));
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login/);
});

test("a térképszerkesztő billentyűzettel festhető", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Felhasználónév").fill(DEMO.username);
  await page.getByLabel("Jelszó").fill(DEMO.password);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Térképek" })).toBeVisible();
  await page.goto("/maps/new");
  const grid = page.getByRole("grid", { name: "Térképrács" });
  await tabUntil(page, async () =>
    grid.evaluate((element) => element.contains(document.activeElement)),
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("2");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("gridcell", { name: "1. sor, 2. oszlop: arany" })).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "1. sor, 2. oszlop: Arany" }),
  ).toBeAttached();
});
