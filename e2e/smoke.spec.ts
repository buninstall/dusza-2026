import { expect, test } from "@playwright/test";
import { editor, login, openPlay } from "./helpers.ts";

test("bejelentkezés → térképlista → játék → kijelentkezés", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await login(page);

  await expect(page.getByRole("heading", { level: 2, name: "1. Egyenes folyosó" })).toBeVisible();
  await openPlay(page, "1. Egyenes folyosó");
  await expect(editor(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Műszerek" })).toBeVisible();

  await page.getByRole("button", { name: /^Felhasználói menü/ }).click();
  await page.getByRole("menuitem", { name: "Kijelentkezés" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/maps");
  await expect(page).toHaveURL(/\/login/);
});

test("a kézikönyv és a futásnapló elérhető a navigációból", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Kézikönyv" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kézikönyv" })).toBeVisible();
  await page.getByRole("link", { name: /Lépésszámlálás/ }).click();
  await expect(page).toHaveURL(/#lepesek$/);
  await expect(page.getByRole("heading", { level: 2, name: /Lépésszámlálás/ })).toBeVisible();
  await page.getByRole("link", { name: "Futásaim" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Futásaim" })).toBeVisible();
});
