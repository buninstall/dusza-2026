import { expect, type Page, test } from "@playwright/test";
import {
  type Account,
  expectFinished,
  expectRuntimeError,
  importMapFile,
  loginAs,
  logout,
  openLeaderboardFromPlay,
  readTable,
  register,
  replaceProgram,
  setSpeed,
  uniqueName,
} from "./helpers.ts";
import { LOOP_RECIPE, OPTIMAL_RECIPES, recipePath, recipeText } from "./recipes.ts";

const BEST = OPTIMAL_RECIPES[0]?.program ?? "";

type Attempt = { source: string; gold: number; steps: number; error?: string };

const ONE_GOLD: Attempt = { source: "step forward 3\nmine here\n", gold: 1, steps: 2 };
const EMPTY: Attempt = { source: "", gold: 0, steps: 0 };
const OPTIMAL: Attempt = { source: recipeText(BEST), gold: 2, steps: 4 };
const LOOP: Attempt = { source: recipeText(LOOP_RECIPE.program), gold: 2, steps: 56 };
const CRASH: Attempt = { source: "step forward 8\n", gold: 0, steps: 1, error: "E_BEDROCK_HIT" };

async function createMap(page: Page, title: string): Promise<string> {
  await page.goto("/maps/new");
  await importMapFile(page, recipePath("palyak/01-egyenes-folyoso.txt"));
  await expect(page.getByRole("gridcell")).toHaveCount(8);
  await page.getByRole("textbox", { name: /Cím/ }).fill(title);
  await page.getByRole("button", { name: "Mentés", exact: true }).click();
  await expect(page).toHaveURL(/\/maps\/\d+\/edit$/);
  await page.getByRole("link", { name: "Kipróbálás" }).click();
  await expect(page).toHaveURL(/\/play\/\d+/);
  return page.url();
}

async function attempt(page: Page, playUrl: string, run: Attempt): Promise<void> {
  await page.goto(playUrl);
  await replaceProgram(page, run.source);
  await setSpeed(page, "max");
  await page.getByRole("button", { name: "Futtatás" }).click();
  if (run.error) {
    await expectRuntimeError(page, run.error, 1, run.steps);
  } else {
    await expectFinished(page, run.gold, run.steps);
  }
}

test("a ranglista arany szerint csökkenő, egyenlőségnél lépés szerint növekvő, felhasználónként a legjobb futással", async ({
  page,
}) => {
  test.slow();
  const title = uniqueName("Rangsor");
  const owner = await register(page, "rangA");
  const playUrl = await createMap(page, title);
  await attempt(page, playUrl, OPTIMAL);
  await attempt(page, playUrl, ONE_GOLD);
  await logout(page);

  const plan: [string, Attempt[]][] = [
    ["rangB", [LOOP]],
    ["rangC", [ONE_GOLD, CRASH]],
    ["rangD", [EMPTY]],
    ["rangE", [OPTIMAL]],
  ];
  const accounts: Account[] = [owner];
  for (const [prefix, runs] of plan) {
    const account = await register(page, prefix);
    accounts.push(account);
    for (const run of runs) {
      await attempt(page, playUrl, run);
    }
    await logout(page);
  }

  await loginAs(page, owner);
  await page.goto(playUrl);
  await openLeaderboardFromPlay(page);
  await expect(page.getByRole("heading", { level: 1, name: `Ranglista – ${title}` })).toBeVisible();
  const table = page.getByRole("table", { name: `Ranglista: ${title}, 1. verzió` });
  await expect(table).toBeVisible();
  const rows = await readTable(table);
  const [a, b, c, d, e] = accounts.map((account) => account.username);
  expect(rows.map((row) => row.Játékos?.replace(/te$/, ""))).toEqual([a, e, b, c, d]);
  expect(rows.map((row) => row.Hely)).toEqual(["1.", "2.", "3.", "4.", "5."]);
  expect(rows.map((row) => row.Arany)).toEqual(["2", "2", "2", "1", "0"]);
  expect(rows.map((row) => row.Lépés)).toEqual(["4", "4", "56", "2", "0"]);
  expect(rows.map((row) => row.Kimenet)).toEqual([
    "hiba nélkül",
    "hiba nélkül",
    "hiba nélkül",
    "hiba nélkül",
    "hiba nélkül",
  ]);
  await expect(table.getByRole("rowheader", { name: new RegExp(`^${a}`) })).toContainText("te");
});
