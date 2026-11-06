import { expect, type Page, test } from "@playwright/test";
import {
  editorCell,
  editorGrid,
  expectFinished,
  exportMap,
  importMapFile,
  login,
  openFromLibrary,
  pickDirection,
  pickTool,
  readTable,
  setSpeed,
  uniqueName,
} from "./helpers.ts";
import { INVALID_MAPS, OPTIMAL_RECIPES, recipeBytes, recipePath } from "./recipes.ts";

const DEFAULT_CELLS = 70;

async function openNewMap(page: Page): Promise<void> {
  await page.goto("/maps/new");
  await expect(page.getByRole("heading", { level: 1, name: "Új térkép" })).toBeVisible();
  await expect(editorGrid(page).getByRole("gridcell")).toHaveCount(DEFAULT_CELLS);
}

function sizeField(page: Page, name: "Sorok" | "Oszlopok") {
  return page.getByRole("textbox", { name, exact: true });
}

async function setSize(page: Page, name: "Sorok" | "Oszlopok", value: string): Promise<void> {
  const field = sizeField(page, name);
  await field.fill(value);
  await field.press("Tab");
}

function stepper(page: Page, field: "Sorok" | "Oszlopok", action: "növelése" | "csökkentése") {
  return page.getByRole("button", {
    name: new RegExp(`^(${field} ${action}|${action} ${field})$`),
  });
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: /^Mentés/ });
}

async function expectSaveRefused(page: Page): Promise<void> {
  const save = saveButton(page);
  await expect(save).toHaveAttribute("data-blocked", "true");
  const url = page.url();
  await save.click();
  await expect(page.getByRole("heading", { level: 2, name: "Ellenőrzés" })).toBeFocused();
  await expect(page.getByText(/^Még nem menthető: \d+ hiba\./)).toBeAttached();
  expect(page.url()).toBe(url);
}

function mapRow(text: string, row: number): string {
  return text.split("\n")[row] ?? "";
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("a méret csak 1 és 15 között állítható", async ({ page }) => {
  await openNewMap(page);
  await setSize(page, "Sorok", "16");
  await expect(sizeField(page, "Sorok")).toHaveValue("15");
  await expect(stepper(page, "Sorok", "növelése")).toBeDisabled();
  await expect(editorGrid(page).getByRole("gridcell")).toHaveCount(150);
  await setSize(page, "Oszlopok", "99");
  await expect(sizeField(page, "Oszlopok")).toHaveValue("15");
  await expect(editorGrid(page).getByRole("gridcell")).toHaveCount(225);
  await setSize(page, "Sorok", "0");
  await expect(sizeField(page, "Sorok")).toHaveValue("1");
  await expect(stepper(page, "Sorok", "csökkentése")).toBeDisabled();
  await setSize(page, "Oszlopok", "0");
  await expect(sizeField(page, "Oszlopok")).toHaveValue("1");
  await expect(editorGrid(page).getByRole("gridcell")).toHaveCount(1);
  await expect(editorCell(page, 1, 1)).toHaveAccessibleName("1. sor, 1. oszlop: robot, kelet felé");
  await stepper(page, "Oszlopok", "növelése").click();
  await expect(sizeField(page, "Oszlopok")).toHaveValue("2");
  await page.getByRole("textbox", { name: /Cím/ }).fill("Egycellás");
  await expect(page.getByText("A térkép érvényes, menthető.")).toBeVisible();
  await expect(saveButton(page)).toHaveAttribute("data-blocked", "false");
  const exported = await exportMap(page);
  expect(exported.bytes.toString("utf8")).toBe("1 2\n>.\n");
});

test("minden mezőtípus festhető, pontosan egy robot van, mind a négy iránnyal, aranyon soha", async ({
  page,
}) => {
  await openNewMap(page);
  await page.getByRole("textbox", { name: /Cím/ }).fill("Festőpróba");

  await pickTool(page, "Arany");
  await editorCell(page, 1, 3).click();
  await expect(editorCell(page, 1, 3)).toHaveAccessibleName("1. sor, 3. oszlop: arany");
  await pickTool(page, "Fal");
  await editorCell(page, 2, 3).click();
  await expect(editorCell(page, 2, 3)).toHaveAccessibleName("2. sor, 3. oszlop: fal");
  await pickTool(page, "Üres kamra");
  await editorCell(page, 2, 3).click();
  await expect(editorCell(page, 2, 3)).toHaveAccessibleName("2. sor, 3. oszlop: üres kamra");

  const robots = editorGrid(page).getByRole("gridcell", { name: /robot/ });
  await pickDirection(page, "észak");
  await pickTool(page, "Robot");
  await editorCell(page, 3, 5).click();
  await expect(robots).toHaveCount(1);
  await expect(editorCell(page, 3, 5)).toHaveAccessibleName("3. sor, 5. oszlop: robot, észak felé");
  await expect(editorCell(page, 1, 1)).toHaveAccessibleName("1. sor, 1. oszlop: üres kamra");

  const symbols = { észak: "^", nyugat: "<", dél: "v", kelet: ">" } as const;
  for (const [dir, symbol] of Object.entries(symbols) as [keyof typeof symbols, string][]) {
    await pickDirection(page, dir);
    await expect(editorCell(page, 3, 5)).toHaveAccessibleName(
      `3. sor, 5. oszlop: robot, ${dir} felé`,
    );
    const exported = await exportMap(page);
    expect(exported.name).toBe("Festoproba.txt");
    expect(mapRow(exported.bytes.toString("utf8"), 3)).toBe(`....${symbol}.....`);
  }

  await pickTool(page, "Arany");
  await editorCell(page, 3, 5).click();
  await expect(editorCell(page, 3, 5)).toHaveAccessibleName("3. sor, 5. oszlop: arany");
  await expect(robots).toHaveCount(0);
  await expect(page.getByText("A térkép így nem menthető.")).toBeVisible();
  await expect(page.getByText("Nincs robot.", { exact: true })).toBeVisible();
  await expectSaveRefused(page);
  await expect(page.getByRole("button", { name: "Exportálás", exact: true })).toHaveAttribute(
    "data-blocked",
    "true",
  );
  await page.getByRole("button", { name: "Exportálás", exact: true }).click();
  await expect(page.getByText("Csak érvényes térkép exportálható.")).toBeVisible();

  await pickTool(page, "Robot");
  await editorCell(page, 1, 3).click();
  await expect(editorCell(page, 1, 3)).toHaveAccessibleName("1. sor, 3. oszlop: robot, kelet felé");
  await expect(robots).toHaveCount(1);
  await expect(saveButton(page)).toHaveAttribute("data-blocked", "false");
  const exported = await exportMap(page);
  expect(mapRow(exported.bytes.toString("utf8"), 1)).toBe("..>.......");
  expect(mapRow(exported.bytes.toString("utf8"), 3)).toBe("....@.....");

  await page.getByRole("textbox", { name: /Cím/ }).fill("");
  await expect(page.getByText("A térkép címe hiányzik.")).toBeVisible();
  await expectSaveRefused(page);
});

test("minden mintapálya fájlból betölthető, és az exportja bájtra egyezik a fájllal", async ({
  page,
}) => {
  await openNewMap(page);
  await page.getByRole("textbox", { name: /Cím/ }).fill("Importpróba");
  for (const recipe of OPTIMAL_RECIPES) {
    const original = recipeBytes(recipe.mapFile);
    const [rows = 0, cols = 0] = (original.toString("utf8").split("\n")[0] ?? "")
      .split(" ")
      .map(Number);
    await importMapFile(page, recipePath(recipe.mapFile));
    await expect(editorGrid(page).getByRole("gridcell")).toHaveCount(rows * cols);
    await expect(sizeField(page, "Sorok")).toHaveValue(String(rows));
    await expect(sizeField(page, "Oszlopok")).toHaveValue(String(cols));
    const exported = await exportMap(page);
    expect(exported.name).toBe("Importproba.txt");
    expect(exported.bytes.equals(original), recipe.mapFile).toBe(true);
  }
});

test("a hibás térképfájl magyar hibaüzenettel elutasítva, az előző tartalom érintetlen", async ({
  page,
}) => {
  await openNewMap(page);
  await importMapFile(page, recipePath("palyak/03-kis-labirintus.txt"));
  await expect(editorGrid(page).getByRole("gridcell")).toHaveCount(49);
  for (const invalid of INVALID_MAPS) {
    await importMapFile(page, recipePath(invalid.file));
    const alert = page.getByRole("alert").filter({ hasText: "nem érvényes térkép" });
    await expect(alert, invalid.file).toContainText(
      "Az importált fájl nem érvényes térkép, ezért nem töltöttük be.",
    );
    await expect(alert, invalid.file).toContainText(invalid.title);
    await expect(editorGrid(page).getByRole("gridcell")).toHaveCount(49);
    await expect(editorCell(page, 1, 1)).toHaveAccessibleName("1. sor, 1. oszlop: robot, dél felé");
    await expect(editorCell(page, 1, 6)).toHaveAccessibleName("1. sor, 6. oszlop: arany");
  }
});

test("futással rendelkező térkép módosítása új verziót hoz létre, a ranglista verziónként külön", async ({
  page,
}) => {
  const title = uniqueName("Verzio");
  await openNewMap(page);
  await importMapFile(page, recipePath("palyak/01-egyenes-folyoso.txt"));
  await page.getByRole("textbox", { name: /Cím/ }).fill(title);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/maps\/\d+\/edit$/);
  await page.getByRole("link", { name: "Kipróbálás" }).click();
  await expect(page).toHaveURL(/\/play\/\d+/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(/^v1 · \d+×\d+ · \d+ arany$/)).toBeVisible();

  await openFromLibrary(page, "Recept – 1. Egyenes folyosó");
  await setSpeed(page, "max");
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expectFinished(page, 2, 4);

  await page.getByRole("link", { name: "Térkép szerkesztése" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Térkép szerkesztése" })).toBeVisible();
  await expect(page.getByText("Jelenleg a(z) 1. verzió aktív.")).toBeVisible();
  await expect(
    page.getByText(
      "Ehhez a verzióhoz már 1 futás tartozik, ezért a tartalom módosítása új verziót hoz létre (v2); a régi ranglista megmarad.",
    ),
  ).toBeVisible();
  await pickTool(page, "Fal");
  await editorCell(page, 1, 8).click();
  await saveButton(page).click();
  await expect(
    page.getByText("A térkép elmentve, új verzióként (v2). A korábbi ranglista megmaradt."),
  ).toBeVisible();
  await expect(page.getByText("Jelenleg a(z) 2. verzió aktív.")).toBeVisible();
  await expect(
    page.getByText("Ehhez a verzióhoz még nincs futás, ezért a módosítás helyben mentődik."),
  ).toBeVisible();

  await page.getByRole("textbox", { name: /Leírás/ }).fill("Csak a leírás változik.");
  await saveButton(page).click();
  await expect(page.getByText("A térkép elmentve.", { exact: true })).toBeVisible();
  await expect(page.getByText("Jelenleg a(z) 2. verzió aktív.")).toBeVisible();

  await page.getByRole("link", { name: "Kipróbálás" }).click();
  await expect(page.getByText(/^v2 · \d+×\d+ · \d+ arany$/)).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "1. sor, 8. oszlop: fal" })).toBeAttached();
  await page.getByRole("link", { name: "Ranglista" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Ranglista – ${title}` })).toBeVisible();
  await expect(page.getByText("Ezen a verzión még nincs futás.")).toBeVisible();
  await page.getByRole("button", { name: /Verzió/ }).click();
  await page.getByRole("option", { name: "1. verzió", exact: true }).click();
  const table = page.getByRole("table", { name: `Ranglista: ${title}, 1. verzió` });
  await expect(table).toBeVisible();
  const rows = await readTable(table);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.["Játékos"]).toMatch(/^demo1/);
  expect(rows[0]?.["Arany"]).toBe("2");
  expect(rows[0]?.["Lépés"]).toBe("4");
});
