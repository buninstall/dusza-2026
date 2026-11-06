import { readFile } from "node:fs/promises";
import { expect, type FileChooser, type Locator, type Page } from "@playwright/test";

export type UploadFile = Parameters<FileChooser["setFiles"]>[0];

export type Account = { username: string; password: string };

export const DEMO: Account = { username: "demo1", password: "demo2026" };
export const ADMIN: Account = { username: "admin", password: "dusza2026" };
export const NEW_PASSWORD = "banyasz2026";

export type Theme = "tarna" | "felszin";

export const THEMES: readonly Theme[] = ["tarna", "felszin"];

export async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    (value) => window.localStorage.setItem("minescript.theme", value),
    theme,
  );
}

export async function loginAs(page: Page, account: Account): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Felhasználónév").fill(account.username);
  await page.getByLabel("Jelszó").fill(account.password);
  await page.getByRole("button", { name: "Belépés" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pályák" })).toBeVisible();
}

export async function login(page: Page): Promise<void> {
  await loginAs(page, DEMO);
}

export function uniqueName(prefix: string): string {
  const stamp = Date.now().toString(36);
  const salt = Math.floor(Math.random() * 46_656).toString(36);
  return `${prefix}_${stamp}${salt}`.slice(0, 24);
}

export async function register(page: Page, prefix: string): Promise<Account> {
  const account = { username: uniqueName(prefix), password: NEW_PASSWORD };
  await page.goto("/register");
  await page.getByLabel("Felhasználónév").fill(account.username);
  await page.getByLabel("Jelszó").fill(account.password);
  await page.getByRole("button", { name: "Fiók létrehozása" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pályák" })).toBeVisible();
  return account;
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Felhasználói menü/ }).click();
  await page.getByRole("menuitem", { name: "Kijelentkezés" }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function openPlay(page: Page, title: string): Promise<void> {
  await page.getByRole("link", { name: `Játék: ${title}`, exact: true }).click();
  await expect(page).toHaveURL(/\/play\/\d+/);
  await expect(page.getByRole("grid", { name: `${title} térképe` })).toBeVisible();
}

export async function gotoPlay(page: Page, title: string): Promise<void> {
  await page.goto("/maps");
  await openPlay(page, title);
}

export function editor(page: Page): Locator {
  return page.getByRole("textbox", { name: "MineScript program" });
}

export async function replaceProgram(page: Page, source: string): Promise<void> {
  const box = editor(page);
  await box.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  if (source.length > 0) {
    await page.keyboard.insertText(source);
    await expect(box).toHaveText(source.replaceAll("\n", ""));
  } else {
    await expect(box.locator(".cm-placeholder")).toBeVisible();
  }
}

export async function runProgram(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expect(page.getByText("Fut", { exact: true })).toBeVisible();
}

export function mapGrid(page: Page): Locator {
  return page.getByRole("grid", { name: /térképe$/ });
}

export function cell(page: Page, row: number, col: number): Locator {
  return mapGrid(page).getByRole("gridcell", {
    name: new RegExp(`^${row}\\. sor, ${col}\\. oszlop: `),
  });
}

export function instruments(page: Page): Locator {
  return page.getByRole("region", { name: "Műszerek" });
}

export type Readings = {
  gold?: number;
  goldTotal?: number;
  steps?: number;
  line?: number | null;
  row?: number;
  col?: number;
  dir?: "észak" | "kelet" | "dél" | "nyugat";
  status?: "Készenlét" | "Fut" | "Szünet" | "Vége" | "Leállítva" | "Hiba";
};

function readingPatterns(readings: Readings): RegExp[] {
  const patterns: RegExp[] = [];
  if (readings.gold !== undefined) {
    const total = readings.goldTotal === undefined ? "\\d+" : String(readings.goldTotal);
    patterns.push(new RegExp(`Arany\\s*${readings.gold}\\s*/\\s*${total}(?!\\d)`));
  }
  if (readings.steps !== undefined) {
    patterns.push(new RegExp(`Lépés\\s*${readings.steps}\\s*/\\s*1000`));
  }
  if (readings.line !== undefined) {
    patterns.push(new RegExp(`Sor\\s*${readings.line === null ? "–" : readings.line}(?!\\d)`));
  }
  if (readings.row !== undefined && readings.col !== undefined) {
    const dir = readings.dir ?? "\\S+";
    patterns.push(new RegExp(`Pozíció\\s*${readings.row}:${readings.col}(?!\\d)\\s*${dir}`));
  }
  if (readings.status !== undefined) {
    patterns.push(new RegExp(`Állapot\\s*${readings.status}(?!\\p{L})`, "u"));
  }
  return patterns;
}

export async function expectReadings(page: Page, readings: Readings): Promise<void> {
  for (const pattern of readingPatterns(readings)) {
    await expect(instruments(page)).toContainText(pattern);
  }
}

export async function readNumber(page: Page, label: "Arany" | "Lépés" | "Sor"): Promise<number> {
  const text = (await instruments(page).textContent()) ?? "";
  const match = new RegExp(`${label}\\s*(\\d+)`).exec(text);
  return match ? Number(match[1]) : Number.NaN;
}

export function executedLine(page: Page): Locator {
  return editor(page).locator('[aria-current="step"]');
}

export function speedSlider(page: Page): Locator {
  return page.getByRole("slider", { name: "Sebesség" });
}

export function timelineSlider(page: Page): Locator {
  return page.getByRole("slider", { name: "Idővonal" });
}

export async function setSpeed(page: Page, edge: "min" | "max"): Promise<void> {
  const slider = speedSlider(page);
  await slider.focus();
  await page.keyboard.press(edge === "max" ? "End" : "Home");
  await expect(slider).toHaveAttribute("aria-valuetext", edge === "max" ? "30 sor/s" : "1 sor/s");
}

export function transport(page: Page, name: string): Locator {
  return page.getByRole("region", { name: "Lejátszásvezérlés" }).getByRole("button", { name });
}

export function finishedReport(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: "Sikeres futás" });
}

export function stoppedReport(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: "Leállítva" });
}

export function runtimeErrorReport(page: Page, line: number): Locator {
  return page
    .getByRole("status")
    .filter({ has: page.getByRole("button", { name: `Mutasd a(z) ${line}. sort` }) });
}

export function syntaxReport(page: Page): Locator {
  return page.getByRole("alert").filter({ hasText: "szintaktikailag hibás" });
}

export async function expectFinished(page: Page, gold: number, steps: number): Promise<void> {
  const report = finishedReport(page);
  await expect(report).toContainText(
    `A program hiba nélkül lefutott: ${gold} arany, ${steps} lépés.`,
  );
  await expect(report).toContainText(`A szerver rögzítette: ${gold} arany, ${steps} lépés.`);
}

export async function expectRuntimeError(
  page: Page,
  code: string,
  line: number,
  steps: number,
): Promise<void> {
  const report = runtimeErrorReport(page, line);
  await expect(report).toContainText(`${code} · ${line}. sor`);
  await expect(report).toContainText(/A szerver rögzítette: \d+ arany, \d+ lépés\./);
  await expect(report).toContainText(`${steps} lépés.`);
}

export async function dismissToasts(page: Page): Promise<void> {
  const close = page
    .getByRole("region", { name: "Értesítések" })
    .getByRole("button", { name: "Értesítés bezárása" });
  for (let remaining = await close.count(); remaining > 0; remaining -= 1) {
    await close.first().click();
    await expect(close).toHaveCount(remaining - 1);
  }
}

export async function openFromLibrary(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Programtár", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mentett programok" });
  await dialog.getByRole("button", { name: `Megnyitás: ${title}`, exact: true }).click();
  const loaded = page.getByText(`A(z) „${title}” program megnyitva.`).first();
  const confirm = dialog
    .getByRole("alert")
    .filter({ hasText: "Felülírod a szerkesztő tartalmát?" });
  await expect(loaded.or(confirm)).toBeVisible();
  if (await confirm.isVisible()) {
    await confirm.getByRole("button", { name: "Megnyitás", exact: true }).click();
  }
  await expect(loaded).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Megnyitva: ${title}`)).toBeVisible();
  await dismissToasts(page);
}

function programFileMenu(page: Page): Locator {
  return page.getByRole("region", { name: "Program" }).getByRole("button", { name: "Fájl" });
}

export async function importProgramFile(page: Page, path: UploadFile): Promise<void> {
  await dismissToasts(page);
  const chooser = page.waitForEvent("filechooser");
  await programFileMenu(page).click();
  await page.getByRole("menuitem", { name: "Importálás fájlból…" }).click();
  await (await chooser).setFiles(path);
}

export async function importMapFile(page: Page, path: UploadFile): Promise<void> {
  await dismissToasts(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Importálás", exact: true }).click();
  await (await chooser).setFiles(path);
}

export async function downloadBytes(
  page: Page,
  trigger: Locator,
): Promise<{
  name: string;
  bytes: Buffer;
}> {
  await dismissToasts(page);
  const download = page.waitForEvent("download");
  await trigger.click();
  const file = await download;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

export async function exportProgram(page: Page): Promise<{ name: string; bytes: Buffer }> {
  await dismissToasts(page);
  await programFileMenu(page).click();
  return downloadBytes(page, page.getByRole("menuitem", { name: "Exportálás fájlba" }));
}

export async function exportMap(page: Page): Promise<{ name: string; bytes: Buffer }> {
  return downloadBytes(page, page.getByRole("button", { name: "Exportálás", exact: true }));
}

export async function expectRecorded(page: Page, gold: number, steps: number): Promise<void> {
  await expect(
    page.getByText(`A szerver rögzítette: ${gold} arany, ${steps} lépés.`),
  ).toBeVisible();
}

export async function pickView(page: Page, view: "Lámpafény" | "Teljes térkép"): Promise<void> {
  await page.getByRole("radiogroup", { name: "Nézet" }).getByText(view, { exact: true }).click();
  await expect(page.getByRole("radio", { name: view })).toBeChecked();
}

export function editorGrid(page: Page): Locator {
  return page.getByRole("grid", { name: "Térképrács" });
}

export function editorCell(page: Page, row: number, col: number): Locator {
  return editorGrid(page).getByRole("gridcell", {
    name: new RegExp(`^${row}\\. sor, ${col}\\. oszlop: `),
  });
}

export async function pickTool(
  page: Page,
  tool: "Üres kamra" | "Arany" | "Fal" | "Robot",
): Promise<void> {
  await page
    .getByRole("radiogroup", { name: "Festőeszköz" })
    .getByText(tool, { exact: true })
    .click();
  await expect(page.getByRole("radio", { name: new RegExp(`^${tool}`) })).toBeChecked();
}

export async function pickDirection(
  page: Page,
  dir: "észak" | "kelet" | "dél" | "nyugat",
): Promise<void> {
  const radio = page.getByRole("radio", { name: dir, exact: true });
  await page
    .getByRole("radiogroup", { name: "A robot kezdőiránya" })
    .locator("label", { has: radio })
    .click();
  await expect(radio).toBeChecked();
}

export type TableRow = Record<string, string>;

export async function readTable(table: Locator): Promise<TableRow[]> {
  const headers = (await table.getByRole("columnheader").allTextContents()).map((text) =>
    text.trim(),
  );
  const rows = table.getByRole("row").filter({ has: table.page().getByRole("rowheader") });
  const result: TableRow[] = [];
  for (const row of await rows.all()) {
    const cells = await row.getByRole("rowheader").or(row.getByRole("cell")).allTextContents();
    result.push(
      Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()])),
    );
  }
  return result;
}

export async function expectFocusVisible(page: Page): Promise<void> {
  const indicator = await page.evaluate(() => {
    const ANCESTORS = 4;
    const MIN_WIDTH = 2;
    let current = document.activeElement;
    for (let depth = 0; current && depth <= ANCESTORS; depth += 1) {
      const style = getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      const isVisible = rect.width > 1 && rect.height > 1;
      const hasOutline =
        style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= MIN_WIDTH;
      if (isVisible && hasOutline) {
        return `${current.tagName} ${style.outlineWidth} ${style.outlineColor}`;
      }
      current = current.parentElement;
    }
    const active = document.activeElement;
    return `NINCS: ${active?.tagName ?? "-"} ${active?.getAttribute("aria-label") ?? active?.textContent?.slice(0, 40) ?? ""}`;
  });
  expect(indicator, "a fókuszált elemnek látható fókuszjelzése van").not.toMatch(/^NINCS/);
}

export async function leaveEditor(page: Page): Promise<void> {
  const box = editor(page);
  if (
    (await box.count()) > 0 &&
    (await box.evaluate((element) => element === document.activeElement))
  ) {
    await page.keyboard.press("Escape");
  }
}

export async function tabUntil(
  page: Page,
  matches: () => Promise<boolean>,
  maxPresses = 80,
  key: "Tab" | "Shift+Tab" = "Tab",
): Promise<void> {
  for (let press = 0; press < maxPresses; press += 1) {
    if (await matches()) {
      return;
    }
    await leaveEditor(page);
    await page.keyboard.press(key);
  }
  throw new Error("A keresett elem billentyűzettel nem érhető el.");
}

export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element) {
      return "";
    }
    return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();
  });
}
