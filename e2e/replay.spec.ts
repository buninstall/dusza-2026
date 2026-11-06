import { expect, test } from "@playwright/test";
import {
  editor,
  expectFinished,
  finishedReport,
  gotoPlay,
  login,
  openFromLibrary,
  setSpeed,
} from "./helpers.ts";
import { recipeText } from "./recipes.ts";

const MAP = "2. Az első kanyar";
const RECIPE = "02-az-elso-kanyar.ms";

test("a Futásaim oldal visszajátssza a rögzített futást, és semmit nem küld be újra", async ({
  page,
}) => {
  await login(page);
  await gotoPlay(page, MAP);
  await openFromLibrary(page, `Recept – ${MAP}`);
  await setSpeed(page, "max");
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expectFinished(page, 2, 5);

  await page.getByRole("navigation").getByRole("link", { name: "Futásaim" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Futásaim" })).toBeVisible();
  const submissions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/runs") {
      submissions.push(request.url());
    }
  });
  await page
    .getByRole("link", { name: new RegExp(`^Visszajátszás: ${MAP}, `) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/runs\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(MAP) })).toBeVisible();
  await expect(page.getByText("Rögzített eredmény: 2 arany, 5 lépés.")).toBeVisible();
  await expect(editor(page)).toHaveText(recipeText(RECIPE).replaceAll("\n", ""));
  await expect(finishedReport(page)).toContainText(
    "A program hiba nélkül lefutott: 2 arany, 5 lépés.",
    { timeout: 20_000 },
  );
  expect(submissions).toEqual([]);

  await page.getByRole("button", { name: "Megnyitás a szerkesztőben" }).click();
  await expect(page).toHaveURL(/\/play\/\d+$/);
  await expect(editor(page)).toHaveText(recipeText(RECIPE).replaceAll("\n", ""));
});

test("nem létező vagy hibás futásazonosító: nincs ilyen oldal", async ({ page }) => {
  await login(page);
  for (const path of ["/runs/abc", "/runs/99999999", "/play/abc", "/leaderboard/abc"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "404: nincs ilyen oldal" }),
      path,
    ).toBeVisible();
  }
});
