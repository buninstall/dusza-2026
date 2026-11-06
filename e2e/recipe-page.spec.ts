import { expect, test } from "@playwright/test";
import {
  downloadBytes,
  editor,
  expectFinished,
  login,
  replaceProgram,
  setSpeed,
} from "./helpers.ts";
import { recipeBytes, recipeText } from "./recipes.ts";

test("a kézikönyv csendes bejárata a receptekhez vezet, onnan a recept a pályán nyílik meg", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("navigation").getByRole("link", { name: "Kézikönyv" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kézikönyv" })).toBeVisible();
  await page.getByRole("link", { name: "Receptek: kész programok minden pályához" }).click();
  await expect(page).toHaveURL(/\/manual\/receptek$/);
  await expect(page.getByRole("heading", { level: 2, name: "Pályák" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Hibapróbák" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Hibás térképek" })).toBeVisible();

  const program = await downloadBytes(
    page,
    page.getByRole("button", { name: "03-kis-labirintus.ms letöltése" }),
  );
  expect(program.name).toBe("03-kis-labirintus.ms");
  expect(program.bytes.equals(recipeBytes("03-kis-labirintus.ms"))).toBe(true);

  await page.getByRole("link", { name: "Megnyitás: 03-kis-labirintus.ms" }).click();
  await expect(page).toHaveURL(/\/play\/\d+$/);
  await expect(page.getByText(/„3\. Kis labirintus” recept betöltve/).first()).toBeVisible();
  await expect(editor(page)).toHaveText(recipeText("03-kis-labirintus.ms").replaceAll("\n", ""));
  await expect(editor(page)).toBeFocused();
  await setSpeed(page, "max");
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expectFinished(page, 3, 24);
});

test("nem mentett munka felülírása előtt a receptoldal megerősítést kér", async ({ page }) => {
  await login(page);
  await page.goto("/manual/receptek");
  await page.getByRole("link", { name: "Megnyitás: e-no-gold.ms" }).click();
  await expect(editor(page)).toHaveText(recipeText("hibak/e-no-gold.ms").replaceAll("\n", ""));
  await replaceProgram(page, "print 7\n");
  await page.goto("/manual/receptek");
  await page.getByRole("link", { name: "Megnyitás: e-bedrock-hit.ms" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Felülírod a szerkesztő tartalmát?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Mégse" }).click();
  await expect(dialog).toBeHidden();
  await expect(editor(page)).toHaveText("print 7");
  await expect(page).toHaveURL(/\/play\/\d+$/);
});
