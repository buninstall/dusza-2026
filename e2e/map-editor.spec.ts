import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { importMapFile, login } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Új térkép" }).first().click();
  await expect(page.getByRole("grid", { name: "Térképrács" })).toBeVisible();
});

test("új térkép: festés, ellenőrzés, mentés és exportálás", async ({ page }) => {
  const save = page.getByRole("button", { name: "Mentés" });
  await expect(page.getByText("A térkép címe hiányzik.")).toBeVisible();
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/maps") {
      posts.push(request.url());
    }
  });
  await save.click();
  await expect(page.getByText(/Még nem menthető: \d+ hiba/)).toBeAttached();
  await expect(page.getByRole("heading", { level: 2, name: "Ellenőrzés" })).toBeFocused();
  await expect(page).toHaveURL(/\/maps\/new$/);
  expect(posts).toEqual([]);

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
  await expect(page).toHaveURL(/\/maps\/\d+\/edit$/);
  await expect(page.getByRole("heading", { level: 1, name: "Térkép szerkesztése" })).toBeVisible();
  expect(posts).toHaveLength(1);
  await expect(page.getByRole("link", { name: "Kipróbálás" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportálás" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("E2E-akna.txt");
  const content = await readFile(await download.path(), "utf8");
  expect(content.split("\n").slice(0, 3)).toEqual(["7 10", ">.@.......", "..#......."]);

  await page.getByRole("link", { name: "Kipróbálás" }).click();
  await expect(page).toHaveURL(/\/play\/\d+/);
  await expect(page.getByRole("heading", { level: 1, name: "E2E akna" })).toBeVisible();
});

test("festésmódok, visszavonás, robotforgatás és a kilépés megerősítése", async ({ page }) => {
  const cell = (row: number, col: number, content: string) =>
    page.getByRole("gridcell", { name: `${row}. sor, ${col}. oszlop: ${content}` });
  await cell(2, 2, "üres kamra").click();
  await expect(cell(2, 2, "fal")).toBeVisible();
  await page.keyboard.press("t");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("2 × 2")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(cell(3, 3, "fal")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(cell(3, 3, "üres kamra")).toBeVisible();
  await expect(cell(2, 2, "fal")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(cell(3, 3, "fal")).toBeVisible();
  await page.getByRole("button", { name: "Visszavonás" }).click();
  await page.getByRole("button", { name: "Visszavonás" }).click();
  await expect(cell(2, 2, "üres kamra")).toBeVisible();

  await cell(1, 1, "robot, kelet felé").focus();
  await page.keyboard.press("r");
  await expect(cell(1, 1, "robot, észak felé")).toBeVisible();
  await page.keyboard.press("Shift+R");
  await expect(cell(1, 1, "robot, kelet felé")).toBeVisible();

  await page.keyboard.press("k");
  await page.keyboard.press("2");
  await cell(4, 4, "üres kamra").click();
  await expect(page.getByText(/Kitöltés: 69 mező, Arany/)).toBeAttached();
  await expect(cell(7, 10, "arany")).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Pályák" }).click();
  const leave = page.getByRole("alertdialog", { name: "Nem mentett módosítások" });
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "Maradok" }).click();
  await expect(page).toHaveURL(/\/maps\/new$/);
  await page.getByRole("navigation").getByRole("link", { name: "Pályák" }).click();
  await leave.getByRole("button", { name: "Kilépés mentés nélkül" }).click();
  await expect(page).toHaveURL(/\/maps(\?.*)?$/);
});

test("érvénytelen térképfájl importja elutasítva, semmi nem töltődik be", async ({ page }) => {
  await importMapFile(page, {
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
  await importMapFile(page, {
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
