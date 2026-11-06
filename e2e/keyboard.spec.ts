import { expect, test } from "@playwright/test";
import { DEMO, focusedName, tabUntil } from "./helpers.ts";

test("bejelentkezés és navigáció csak billentyűzettel", async ({ page }) => {
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
    page
      .getByRole("textbox", { name: "MineScript program" })
      .evaluate((element) => element === document.activeElement),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  const leftEditor = await page
    .getByRole("textbox", { name: "MineScript program" })
    .evaluate((element) => element !== document.activeElement);
  expect(leftEditor).toBe(true);

  const grid = page.getByRole("grid", { name: /térképe$/ });
  await tabUntil(page, async () =>
    grid.evaluate((element) => element.contains(document.activeElement)),
  );
  await page.keyboard.press("ArrowRight");
  expect(await focusedName(page)).toMatch(/^1\. sor, 2\. oszlop/);

  await tabUntil(page, async () => (await focusedName(page)).startsWith("Felhasználói menü"));
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login/);
});
