import { expect, type Page, test } from "@playwright/test";
import {
  capitalArticle,
  closeImportRejection,
  editor,
  expectFinished,
  exportProgram,
  gotoPlay,
  importProgramFile,
  importRejection,
  login,
  openConsole,
  setSpeed,
  syntaxReport,
} from "./helpers.ts";
import { LOOP_RECIPE, recipeBytes, recipePath, SYNTAX_RECIPE } from "./recipes.ts";

const CORRIDOR = "1. Egyenes folyosó";
const EXPORT_NAME = "1-Egyenes-folyoso.ms";
const PROGRAM_LIMIT = 100_000;

function diagnostics(page: Page) {
  return page.getByRole("region", { name: /^Hibalista/ });
}

async function expectRejected(page: Page, message: string | RegExp): Promise<void> {
  await expect(importRejection(page)).toContainText(message);
  await closeImportRejection(page);
}

test.beforeEach(async ({ page }) => {
  await login(page);
  await gotoPlay(page, CORRIDOR);
});

test("programfájl tallózással betölthető, szerkeszthető, és bájtra pontosan exportálható", async ({
  page,
}) => {
  await importProgramFile(page, recipePath(LOOP_RECIPE.program));
  await expect(
    page.getByText(
      `${capitalArticle(LOOP_RECIPE.program)} ${LOOP_RECIPE.program} program betöltve.`,
    ),
  ).toBeVisible();
  await expect(diagnostics(page)).toHaveAccessibleName(/Nincs szintaktikai hiba/);
  const original = recipeBytes(LOOP_RECIPE.program);
  const exported = await exportProgram(page);
  expect(exported.name).toBe(EXPORT_NAME);
  expect(exported.bytes.equals(original)).toBe(true);

  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("print 7");
  const edited = await exportProgram(page);
  expect(edited.bytes.toString("utf8")).toBe(`${original.toString("utf8")}print 7`);

  await setSpeed(page, "max");
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expectFinished(page, LOOP_RECIPE.gold, LOOP_RECIPE.steps + 1);
  await openConsole(page);
  const console = page.getByRole("log", { name: "Konzol" });
  await expect(console).toContainText("2");
  await expect(console).toContainText("7");
});

test("a szintaktikailag hibás programfájl nem töltődik be, a hibás sorok listája látszik", async ({
  page,
}) => {
  const before = await exportProgram(page);
  await importProgramFile(page, recipePath(SYNTAX_RECIPE.file));
  const dialog = importRejection(page);
  await expect(dialog).toContainText("A fájl nem felel meg a MineScript nyelvtanának");
  await expect(dialog).toContainText("Fájl: szintaktikai-hibak.ms");
  for (const line of SYNTAX_RECIPE.lines) {
    await expect(dialog.getByText(`${line}. sor`, { exact: true })).toBeVisible();
  }
  await closeImportRejection(page);
  const after = await exportProgram(page);
  expect(after.bytes.equals(before.bytes)).toBe(true);
});

test("a hibás programfájl kérésre megnyílik javításra, futtatáskor a hibás sorai jelölve", async ({
  page,
}) => {
  await importProgramFile(page, recipePath(SYNTAX_RECIPE.file));
  const dialog = importRejection(page);
  await dialog.getByRole("button", { name: "Megnyitás javításra" }).click();
  await expect(dialog).toBeHidden();
  const name = "szintaktikai-hibak.ms";
  await expect(
    page.getByText(
      `${capitalArticle(name)} ${name} program betöltve javításra: ${SYNTAX_RECIPE.lines.length} hibás sor. Futtatás előtt javítsd ki.`,
    ),
  ).toBeVisible();
  await expect(diagnostics(page)).toHaveAccessibleName(
    new RegExp(`${SYNTAX_RECIPE.lines.length} hiba`),
  );
  const loaded = await exportProgram(page);
  expect(loaded.bytes.equals(recipeBytes(SYNTAX_RECIPE.file))).toBe(true);
  await page.getByRole("button", { name: "Futtatás" }).click();
  await expect(syntaxReport(page)).toContainText(`Hibás sorok: ${SYNTAX_RECIPE.lines.join(", ")}.`);
});

test("a Windows-sorvégű programfájl egységes sorvéggel töltődik be", async ({ page }) => {
  await importProgramFile(page, {
    name: "crlf.ms",
    mimeType: "text/plain",
    buffer: Buffer.from("﻿print 1\r\nprint 2\r\n", "utf8"),
  });
  await expect(page.getByText("A crlf.ms program betöltve.")).toBeVisible();
  const exported = await exportProgram(page);
  expect(exported.bytes.toString("utf8")).toBe("print 1\nprint 2\n");
});

test("bináris, NUL-t tartalmazó, nem UTF-8 és túl hosszú fájl elutasítva, a szerkesztő érintetlen", async ({
  page,
}) => {
  await importProgramFile(page, recipePath(LOOP_RECIPE.program));
  const original = recipeBytes(LOOP_RECIPE.program);
  const rejected: { name: string; buffer: Buffer; message: string | RegExp }[] = [
    {
      name: "kep.png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]),
      message: "A fájl nem érvényes UTF-8 szöveg, ezért nem töltöttük be.",
    },
    {
      name: "latin2.ms",
      buffer: Buffer.from([0x70, 0x72, 0x69, 0x6e, 0x74, 0x20, 0xe1, 0x0a]),
      message: "A fájl nem érvényes UTF-8 szöveg, ezért nem töltöttük be.",
    },
    {
      name: "nul.ms",
      buffer: Buffer.from("print 1\u0000\n", "utf8"),
      message: "A fájl NUL karaktert tartalmaz, ezért nem programfájl.",
    },
    {
      name: "hosszu.ms",
      buffer: Buffer.from("x".repeat(PROGRAM_LIMIT + 1), "utf8"),
      message: /A fájl hosszabb 100\s000 karakternél, ezért nem töltöttük be\./,
    },
  ];
  for (const file of rejected) {
    await importProgramFile(page, {
      name: file.name,
      mimeType: "application/octet-stream",
      buffer: file.buffer,
    });
    await expectRejected(page, file.message);
    const exported = await exportProgram(page);
    expect(exported.bytes.equals(original), file.name).toBe(true);
  }
});
