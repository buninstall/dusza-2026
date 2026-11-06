import { expect, test } from "@playwright/test";
import {
  DEMO,
  editor,
  expectFinished,
  expectFocusVisible,
  focusedName,
  leaveEditor,
  tabUntil,
} from "./helpers.ts";

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

test("egy teljes recept betöltése és lefuttatása csak billentyűzettel, mindig látható fókusszal", async ({
  page,
}) => {
  const tabTo = async (name: string) => {
    await tabUntil(page, async () => (await focusedName(page)) === name);
    await expectFocusVisible(page);
  };

  await page.goto("/login");
  await tabUntil(page, async () =>
    page.getByLabel("Felhasználónév").evaluate((element) => element === document.activeElement),
  );
  await expectFocusVisible(page);
  await page.keyboard.type(DEMO.username);
  await page.keyboard.press("Tab");
  await expectFocusVisible(page);
  await page.keyboard.type(DEMO.password);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Térképek" })).toBeVisible();

  await tabTo("Játék: 2. Az első kanyar");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/play\/\d+/);

  await tabTo("Programtár");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Mentett programok" });
  await expect(dialog).toBeVisible();
  await tabTo("Megnyitás: Recept – 2. Az első kanyar");
  await page.keyboard.press("Enter");
  const confirm = dialog.getByRole("button", { name: "Megnyitás", exact: true });
  await expect(confirm).toBeVisible();
  await tabUntil(page, async () =>
    confirm.evaluate((element) => element === document.activeElement),
  );
  await expectFocusVisible(page);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Megnyitva: Recept – 2. Az első kanyar")).toBeVisible();

  await tabUntil(page, async () =>
    page
      .getByRole("slider", { name: "Sebesség" })
      .evaluate((element) => element === document.activeElement),
  );
  await expectFocusVisible(page);
  await page.keyboard.press("End");
  await expect(page.getByRole("slider", { name: "Sebesség" })).toHaveValue("30");
  const run = page.getByRole("button", { name: "Futtatás" });
  await tabUntil(
    page,
    async () => run.evaluate((element) => element === document.activeElement),
    80,
    "Shift+Tab",
  );
  await expect(run).toBeFocused();
  await expectFocusVisible(page);
  await page.keyboard.press("Enter");
  await expectFinished(page, 2, 5);
});

test("a játék oldal minden tabulátor-megállóján látható a fókusz", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Felhasználónév").fill(DEMO.username);
  await page.getByLabel("Jelszó").fill(DEMO.password);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Térképek" })).toBeVisible();
  await page.getByRole("link", { name: "Játék: 1. Egyenes folyosó" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/play\/\d+/);
  const STOPS = 40;
  for (let press = 0; press < STOPS; press += 1) {
    await leaveEditor(page);
    await page.keyboard.press("Tab");
    await expectFocusVisible(page);
  }
});
