import { expect, test } from "@playwright/test";
import { login } from "./helpers.ts";

test("bejelentkezés → térképlista → játék → kijelentkezés", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await login(page);

  await expect(page.getByRole("heading", { level: 2, name: "1. Egyenes folyosó" })).toBeVisible();
  await page.getByRole("link", { name: "Játék: 1. Egyenes folyosó" }).click();
  await expect(page).toHaveURL(/\/play\/\d+/);
  await expect(page.getByRole("textbox", { name: "MineScript program" })).toBeVisible();
  await expect(page.getByRole("grid", { name: /térképe$/ })).toBeVisible();

  await page.getByRole("button", { name: "Futtatás" }).click();
  await expect(page.locator("p", { hasText: "A program hiba nélkül lefutott." })).toBeVisible();
  await expect(page.getByText("Az eredmény rögzítve: 0 arany, 2 lépés.")).toBeVisible();

  await page.getByRole("button", { name: /^Felhasználói menü/ }).click();
  await page.getByRole("menuitem", { name: "Kijelentkezés" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/maps");
  await expect(page).toHaveURL(/\/login/);
});
