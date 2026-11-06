import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { login } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Új térkép" }).first().click();
  await expect(page.getByRole("grid", { name: "Térképrács" })).toBeVisible();
});

test("új térkép: festés, ellenőrzés, mentés és exportálás", async ({ page }) => {
  const save = page.getByRole("button", { name: "Mentés" });
  await expect(save).toBeDisabled();
  await expect(page.getByText("A térkép címe hiányzik.")).toBeVisible();

  await page
    .getByRole("radiogroup", { name: "Festőeszköz" })
    .getByText("Arany", { exact: true })
    .click();
  await page.getByRole("gridcell", { name: "1. sor, 3. oszlop: üres kamra" }).click();
  await expect(page.getByRole("gridcell", { name: "1. sor, 3. oszlop: arany" })).toBeVisible();
  await page.getByRole("gridcell", { name: "1. sor, 3. oszlop: arany" }).press("ArrowDown");
  await page.keyboard.press("3");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("gridcell", { name: "2. sor, 3. oszlop: fal" })).toBeVisible();

  await page.getByRole("textbox", { name: /Cím/ }).fill("E2E akna");
  await expect(page.getByText("A térkép érvényes, menthető.")).toBeVisible();
  await save.click();
  await expect(page).toHaveURL(/\/play\/\d+/);
  await expect(page.getByRole("heading", { level: 1, name: "E2E akna" })).toBeVisible();

  await page.getByRole("link", { name: "Térkép szerkesztése" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E akna szerkesztése" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportálás" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("E2E-akna.txt");
  const content = await readFile(await download.path(), "utf8");
  expect(content.split("\n").slice(0, 3)).toEqual(["7 10", ">.@.......", "..#......."]);
});

test("érvénytelen térképfájl importja elutasítva, semmi nem töltődik be", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "hibas.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("2 3\n>.@\n#.\n", "utf8"),
  });
  const alert = page.getByRole("alert").filter({ hasText: "nem érvényes térkép" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("3. sor");
  await expect(page.getByRole("gridcell")).toHaveCount(70);
});

test("érvényes térképfájl betöltődik", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "jo.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("3 15\n....@..........\n.#############.\n.......@...>...\n", "utf8"),
  });
  await expect(page.getByText("A térkép betöltve a fájlból.")).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(45);
  await expect(
    page.getByRole("gridcell", { name: "3. sor, 12. oszlop: robot, kelet felé" }),
  ).toBeVisible();
});
