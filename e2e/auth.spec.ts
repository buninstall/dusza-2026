import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN,
  DEMO,
  loginAs,
  logout,
  NEW_PASSWORD,
  readTable,
  register,
  uniqueName,
} from "./helpers.ts";

const PROTECTED = [
  "/maps",
  "/maps?scope=mine",
  "/maps/new",
  "/maps/1/edit",
  "/play/1",
  "/leaderboard/1",
  "/runs",
  "/manual",
  "/admin",
];

async function submitCredentials(
  page: Page,
  button: "Belépés" | "Fiók létrehozása",
  username: string,
  password: string,
): Promise<void> {
  await page.getByLabel("Felhasználónév").fill(username);
  await page.getByLabel("Jelszó").fill(password);
  await page.getByRole("button", { name: button }).click();
}

function formError(page: Page, form: "Bejelentkezés" | "Regisztráció") {
  return page.getByRole("region", { name: form }).getByRole("alert");
}

function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Fő navigáció" }).getByRole("link", { name });
}

test("minden funkció csak bejelentkezés után érhető el, a közvetlen cím a belépésre visz", async ({
  page,
}) => {
  for (const path of PROTECTED) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login\?redirect=/);
    await expect(page.getByRole("heading", { level: 1, name: "Bejelentkezés" })).toBeVisible();
  }
  for (const endpoint of ["/api/maps", "/api/me/runs", "/api/programs", "/api/admin/users"]) {
    const response = await page.request.get(endpoint);
    expect(response.status(), endpoint).toBe(401);
  }
  await page.goto("/runs");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await submitCredentials(page, "Belépés", DEMO.username, DEMO.password);
  await expect(page).toHaveURL(/\/runs$/);
  await expect(page.getByRole("heading", { level: 1, name: "Futásaim" })).toBeVisible();
});

test("hibás belépési adatnál magyar hibaüzenet, a hiányzó mezőket a felület jelzi", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Belépés" }).click();
  await expect(page.getByText("Add meg a felhasználónevet.")).toBeVisible();
  await expect(page.getByText("Add meg a jelszót.")).toBeVisible();
  await submitCredentials(page, "Belépés", DEMO.username, "rossz-jelszo");
  await expect(formError(page, "Bejelentkezés")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("regisztráció ellenőrzéssel, belépés, kijelentkezés után a védett oldal újra zárt", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { level: 1, name: "Regisztráció" })).toBeVisible();
  await submitCredentials(page, "Fiók létrehozása", "ab", "rovid");
  await expect(page.getByText("A felhasználónév 3–24 karakter hosszú legyen.")).toBeVisible();
  await expect(page.getByText("A jelszó legalább 8 karakter legyen.")).toBeVisible();
  await submitCredentials(page, "Fiók létrehozása", "ékezetes név", NEW_PASSWORD);
  await expect(
    page.getByText("A felhasználónévben csak angol betű, számjegy és aláhúzás állhat."),
  ).toBeVisible();
  await submitCredentials(page, "Fiók létrehozása", DEMO.username, NEW_PASSWORD);
  await expect(formError(page, "Regisztráció")).toBeVisible();
  await expect(page).toHaveURL(/\/register/);

  const username = uniqueName("ujbanyasz");
  await submitCredentials(page, "Fiók létrehozása", username, NEW_PASSWORD);
  await expect(page.getByRole("heading", { level: 1, name: "Térképek" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Felhasználói menü: ${username}` })).toBeVisible();
  await expect(navLink(page, "Felhasználók")).toHaveCount(0);

  await logout(page);
  await page.goto("/maps");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await loginAs(page, { username, password: NEW_PASSWORD });
  await expect(page.getByRole("button", { name: `Felhasználói menü: ${username}` })).toBeVisible();
});

test("az adminisztrátor kezeli a felhasználókat: szerepkör és törlés, a játékos nem éri el", async ({
  page,
}) => {
  const account = await register(page, "kezelt");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/maps/);
  await logout(page);

  await loginAs(page, ADMIN);
  await navLink(page, "Felhasználók").click();
  await expect(page.getByRole("heading", { level: 1, name: "Felhasználók" })).toBeVisible();
  const table = page.getByRole("table", { name: "Felhasználók" });
  const rows = await readTable(table);
  expect(rows.find((row) => row.Felhasználónév === account.username)?.Szerepkör).toBe("játékos");
  const own = table
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: /^admin/ }) });
  await expect(own.getByRole("button")).toHaveCount(0);

  await page.getByRole("button", { name: `Adminná tétel: ${account.username}` }).click();
  await expect(page.getByText(`${account.username} új szerepköre: adminisztrátor.`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Játékossá tétel: ${account.username}` }),
  ).toBeVisible();
  await logout(page);

  await loginAs(page, account);
  await expect(navLink(page, "Felhasználók")).toBeVisible();
  await logout(page);

  await loginAs(page, ADMIN);
  await page.goto("/admin");
  await page.getByRole("button", { name: `Játékossá tétel: ${account.username}` }).click();
  await expect(page.getByText(`${account.username} új szerepköre: játékos.`)).toBeVisible();
  await page.getByRole("button", { name: `Törlés: ${account.username}` }).click();
  const dialog = page.getByRole("alertdialog", { name: "Biztosan törlöd a fiókot?" });
  await expect(dialog).toContainText(`${account.username} fiókja és minden adata`);
  await dialog.getByRole("button", { name: "Mégse" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("rowheader", { name: account.username })).toBeVisible();
  await page.getByRole("button", { name: `Törlés: ${account.username}` }).click();
  await dialog.getByRole("button", { name: "Törlés", exact: true }).click();
  await expect(page.getByText(`${account.username} fiókja törölve.`)).toBeVisible();
  await expect(page.getByRole("rowheader", { name: account.username })).toHaveCount(0);
  await logout(page);

  await page.getByLabel("Felhasználónév").fill(account.username);
  await page.getByLabel("Jelszó").fill(account.password);
  await page.getByRole("button", { name: "Belépés" }).click();
  await expect(formError(page, "Bejelentkezés")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
