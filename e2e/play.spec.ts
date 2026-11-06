import { expect, type Page, test } from "@playwright/test";
import {
  editor,
  expectFinished,
  importProgramFile,
  login,
  mapGrid,
  openPlay,
  replaceProgram,
  runProgram,
  setSpeed,
} from "./helpers.ts";
import { recipeText } from "./recipes.ts";

const LONG_PROGRAM = [
  "set i to 0",
  "set tovabb to true",
  "while tovabb",
  "    set i to i + 1",
  "    set tovabb to i < 100",
  "print i",
  "",
].join("\n");

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("szintaktikailag hibás program nem fut, a hibás sor jelölve", async ({ page }) => {
  await openPlay(page, "2. Az első kanyar");
  await replaceProgram(page, "print 1\nstep  forward 1\n");
  await page.getByRole("button", { name: "Futtatás" }).click();
  const banner = page.getByRole("alert").filter({ hasText: "szintaktikailag hibás" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/Hibás sor: \d/);
  await expect(
    page
      .getByRole("region", { name: /^Hibalista/ })
      .getByRole("button", { name: /^Ugrás a\(z\) 2\. sorra, hiba/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hibalista/ })).toBeVisible();
});

test("az üres program lefut, és a szerver rögzíti az eredményt a ranglistán", async ({ page }) => {
  await openPlay(page, "1. Egyenes folyosó");
  await replaceProgram(page, "");
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expect(
    page.getByText("A program hiba nélkül lefutott: 0 arany, 0 lépés.").first(),
  ).toBeVisible();
  await expect(page.getByText("A szerver rögzítette: 0 arany, 0 lépés.")).toBeVisible();

  await page.getByRole("link", { name: "Ranglista" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ranglista – 1. Egyenes folyosó" }),
  ).toBeVisible();
  const own = page.getByRole("row").filter({ hasText: "demo1" });
  await expect(own).toContainText("te");
});

test("a programtár receptje végigfut, és a szerver rögzíti a pontos eredményt", async ({
  page,
}) => {
  await openPlay(page, "2. Az első kanyar");
  await page.getByRole("button", { name: "Programtár" }).click();
  await page.getByRole("button", { name: "Megnyitás: Recept – 2. Az első kanyar" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Felülírod a szerkesztő tartalmát?" })
    .getByRole("button", { name: "Megnyitás", exact: true })
    .click();
  await expect(editor(page)).toContainText("turn by 3");
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expect(
    page.getByText("A program hiba nélkül lefutott: 2 arany, 5 lépés.").first(),
  ).toBeVisible();
  await expect(page.getByText("A szerver rögzítette: 2 arany, 5 lépés.")).toBeVisible();
});

test("programfájl importja: a hibás program is betöltődik, a bináris nem", async ({ page }) => {
  await openPlay(page, "3. Kis labirintus");
  await importProgramFile(page, {
    name: "probalkozas.ms",
    mimeType: "text/plain",
    buffer: Buffer.from("set arany to isThere 2\r\nprint  arany\r\n", "utf8"),
  });
  await expect(page.getByText("A(z) probalkozas.ms program betöltve.")).toBeVisible();
  await expect(editor(page)).toContainText("print  arany");
  await importProgramFile(page, {
    name: "kep.ms",
    mimeType: "application/octet-stream",
    buffer: Buffer.from([0x00, 0xff, 0xfe]),
  });
  await expect(page.getByText(/nem érvényes UTF-8|NUL karaktert/).first()).toBeVisible();
  await expect(editor(page)).toContainText("print  arany");
});

async function recordedRunCount(page: Page, mapTitle: string): Promise<number> {
  const response = await page.request.get("/api/me/runs");
  const body = (await response.json()) as { runs: { mapTitle: string }[] };
  return body.runs.filter((run) => run.mapTitle === mapTitle).length;
}

test("a leállított futás nem kerül a ranglistára", async ({ page }) => {
  await openPlay(page, "5. Kígyó");
  const before = await recordedRunCount(page, "5. Kígyó");
  await replaceProgram(page, LONG_PROGRAM);
  await runProgram(page);
  await page.getByRole("button", { name: "Leállítás" }).click();
  await expect(page.getByText("A leállított futás nem kerül a ranglistára.").first()).toBeVisible();
  expect(await recordedRunCount(page, "5. Kígyó")).toBe(before);
});

test("375 px-en a bánya és a program egymás alatt van, a vezérlőpult kéznél", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openPlay(page, "1. Egyenes folyosó");
  await expect(page.getByRole("tab", { name: "Bánya" })).toHaveCount(0);
  await expect(mapGrid(page)).toBeVisible();
  await editor(page).scrollIntoViewIfNeeded();
  await expect(editor(page)).toBeVisible();
  await replaceProgram(page, recipeText("01-egyenes-folyoso.ms"));
  await setSpeed(page, "max");
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expect(mapGrid(page)).toBeInViewport();
  await expectFinished(page, 2, 4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
