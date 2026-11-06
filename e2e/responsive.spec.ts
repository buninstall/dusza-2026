import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN,
  expectReadings,
  gotoPlay,
  loginAs,
  openFromLibrary,
  runtimeErrorReport,
  setSpeed,
  syntaxReport,
  THEMES,
  transport,
  useTheme,
} from "./helpers.ts";
import { auditLayout, settle } from "./layout.ts";

const WIDTHS = [320, 768, 1024, 1440] as const;
const HEIGHT = 900;
const TOUCH_WIDTH = 320;
const TARGET_MIN = 24;

type Screen = { name: string; open: (page: Page) => Promise<void>; scope?: string };

async function heading(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

const SCREENS: readonly Screen[] = [
  {
    name: "terkepek",
    open: async (page) => {
      await page.goto("/maps");
      await heading(page, "Térképek");
    },
  },
  {
    name: "szerkeszto-uj",
    open: async (page) => {
      await page.goto("/maps/new");
      await expect(page.getByRole("grid", { name: "Térképrács" })).toBeVisible();
    },
  },
  {
    name: "szerkeszto-15x15",
    open: async (page) => {
      await page.goto("/maps");
      await page.getByRole("link", { name: "Szerkesztés: 8. A nagy bánya" }).click();
      await heading(page, "8. A nagy bánya szerkesztése");
      await expect(page.getByRole("gridcell")).toHaveCount(225);
    },
  },
  {
    name: "jatek-futas-kozben",
    open: async (page) => {
      await gotoPlay(page, "8. A nagy bánya");
      await openFromLibrary(page, "Recept – 8. A nagy bánya");
      await setSpeed(page, "min");
      await page.getByRole("button", { name: "Futtatás" }).click();
      await transport(page, "Szünet").click();
      await transport(page, "Egy sor előre").click();
      await transport(page, "Egy sor előre").click();
      await expectReadings(page, { status: "Szünet" });
    },
  },
  {
    name: "jatek-programtar",
    scope: "[role='dialog']",
    open: async (page) => {
      await gotoPlay(page, "1. Egyenes folyosó");
      await page.getByRole("button", { name: "Programtár", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Mentett programok" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Megnyitás: Recept – 5. Kígyó" }),
      ).toBeVisible();
    },
  },
  {
    name: "jatek-futasi-hiba",
    open: async (page) => {
      await gotoPlay(page, "1. Egyenes folyosó");
      await openFromLibrary(page, "Hibapróba – E_INT_OVERFLOW");
      await setSpeed(page, "max");
      await page.getByRole("button", { name: "Futtatás" }).click();
      await expect(runtimeErrorReport(page, 3)).toContainText("E_INT_OVERFLOW · 3. sor");
      await expect(page.getByText(/A szerver rögzítette/)).toBeVisible();
    },
  },
  {
    name: "jatek-szintaktikai-hiba",
    open: async (page) => {
      await gotoPlay(page, "1. Egyenes folyosó");
      await openFromLibrary(page, "Hibapróba – szintaktikai hibák");
      await page.getByRole("button", { name: "Futtatás" }).click();
      await expect(syntaxReport(page)).toBeVisible();
    },
  },
  {
    name: "ranglista",
    open: async (page) => {
      await page.goto("/maps");
      await page.getByRole("link", { name: "Ranglista: 1. Egyenes folyosó" }).click();
      await heading(page, "Ranglista – 1. Egyenes folyosó");
      await expect(page.getByRole("table")).toBeVisible();
    },
  },
  {
    name: "kezikonyv",
    open: async (page) => {
      await page.goto("/manual");
      await heading(page, "A MineScript kézikönyve");
    },
  },
  {
    name: "futasaim",
    open: async (page) => {
      await page.goto("/runs");
      await heading(page, "Futásaim");
    },
  },
  {
    name: "felhasznalok",
    open: async (page) => {
      await page.goto("/admin");
      await heading(page, "Felhasználók");
      await expect(page.getByRole("table")).toBeVisible();
    },
  },
];

function screenshotPath(name: string): string {
  const { project, titlePath } = test.info();
  const group = (titlePath[1] ?? "").replace(/[^a-z0-9]+/gi, "-");
  return join(project.outputDir, "screens", `${group}-${name}.png`);
}

async function check(page: Page, name: string, width: number, scope?: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await settle(page);
  await page.screenshot({ path: screenshotPath(name), fullPage: true });
  const issues = [
    ...(await auditLayout(page, {
      minTarget: width === TOUCH_WIDTH ? TARGET_MIN : null,
      ...(scope ? { scope } : {}),
    })),
  ];
  expect.soft(issues, `${name} @ ${width}px`).toEqual([]);
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`${theme} téma, ${width} px`, () => {
      test.use({ viewport: { width, height: HEIGHT } });

      test.beforeEach(async ({ page }) => {
        await useTheme(page, theme);
      });

      test("bejelentkezés és regisztráció", async ({ page }) => {
        await page.goto("/login");
        await heading(page, "Bejelentkezés");
        await check(page, "bejelentkezes", width);
        await page.goto("/register");
        await heading(page, "Regisztráció");
        await page.getByRole("button", { name: "Fiók létrehozása" }).click();
        await expect(page.getByText("Add meg a felhasználónevet.")).toBeVisible();
        await check(page, "regisztracio-hibak", width);
      });

      test("védett oldalak", async ({ page }) => {
        test.slow();
        await loginAs(page, ADMIN);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        for (const screen of SCREENS) {
          await screen.open(page);
          await check(page, screen.name, width, screen.scope);
        }
      });
    });
  }
}
