import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN,
  editorGrid,
  gotoPlay,
  importMapFile,
  login,
  loginAs,
  openFromLibrary,
  openPlay,
  readNumber,
  setSpeed,
  syntaxReport,
  THEMES,
  transport,
  useTheme,
} from "./helpers.ts";
import { settle } from "./layout.ts";
import { recipePath } from "./recipes.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const BLOCKING = new Set(["serious", "critical"]);
const REACT_ARIA_ANNOUNCER = '[role="log"][aria-live="assertive"] > [role="img"]';

async function blockingViolations(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude(REACT_ARIA_ANNOUNCER)
    .analyze();
  return results.violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ""))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

async function expectClean(page: Page, state: string): Promise<void> {
  expect(await blockingViolations(page), state).toEqual([]);
}

for (const theme of THEMES) {
  test.describe(`akadálymentesség (${theme} téma)`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test("bejelentkezés és regisztráció", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Bejelentkezés" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectClean(page, "bejelentkezés");
      await page.goto("/register");
      await expect(page.getByRole("heading", { name: "Regisztráció" })).toBeVisible();
      await expectClean(page, "regisztráció");
      await page.getByRole("button", { name: "Fiók létrehozása" }).click();
      await expect(page.getByText("Add meg a felhasználónevet.")).toBeVisible();
      await expectClean(page, "regisztráció hibákkal");
    });

    test("térképlista, felhasználói menü és ismeretlen oldal", async ({ page }) => {
      await login(page);
      await expectClean(page, "térképlista");
      await page.getByRole("tab", { name: "Sajátjaim" }).click();
      await expect(page.getByRole("tab", { name: "Sajátjaim" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expectClean(page, "saját térképek");
      await page.getByRole("button", { name: /^Felhasználói menü/ }).click();
      await expect(page.getByRole("menuitem", { name: "Kijelentkezés" })).toBeVisible();
      await expectClean(page, "felhasználói menü");
      await page.keyboard.press("Escape");
      await page.goto("/nincs-ilyen-oldal");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectClean(page, "ismeretlen oldal");
    });

    test("játék oldal: alaphelyzet, futás közben, futásidejű és szintaktikai hiba, programtár", async ({
      page,
    }) => {
      await login(page);
      await openPlay(page, "3. Kis labirintus");
      await expectClean(page, "alaphelyzet");
      await openFromLibrary(page, "Recept – 3. Kis labirintus");
      await setSpeed(page, "min");
      await page.getByRole("button", { name: "Futtatás" }).click();
      await transport(page, "Szünet").click();
      await transport(page, "Egy sor előre").click();
      await expectClean(page, "szüneteltetett futás");
      await transport(page, "Leállítás").click();
      await expectClean(page, "leállított futás");

      await gotoPlay(page, "1. Egyenes folyosó");
      await openFromLibrary(page, "Hibapróba – E_BEDROCK_HIT");
      await setSpeed(page, "max");
      await page.getByRole("button", { name: "Futtatás" }).click();
      await expect(page.getByText(/A szerver rögzítette/)).toBeVisible();
      await expectClean(page, "futásidejű hiba");
      await openFromLibrary(page, "Hibapróba – szintaktikai hibák");
      await page.getByRole("button", { name: "Futtatás" }).click();
      await expect(syntaxReport(page)).toBeVisible();
      await expectClean(page, "szintaktikai hiba");
      await page.getByRole("button", { name: "Programtár", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Mentett programok" })).toBeVisible();
      await expectClean(page, "programtár");
    });

    test("térképszerkesztő: új térkép, hibás import, meglévő térkép és törlés megerősítése", async ({
      page,
    }) => {
      await login(page);
      await page.getByRole("link", { name: "Új térkép" }).first().click();
      await expect(editorGrid(page)).toBeVisible();
      await expectClean(page, "új térkép");
      await importMapFile(page, recipePath("hibas-terkepek/ket-robot.txt"));
      await expect(
        page.getByRole("alert").filter({ hasText: "nem érvényes térkép" }),
      ).toBeVisible();
      await expectClean(page, "hibás import");
      await loginAs(page, ADMIN);
      await page.getByRole("link", { name: "Szerkesztés: 4. Zsákutcák" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Térkép szerkesztése" }),
      ).toBeVisible();
      await expectClean(page, "meglévő térkép");
      await page.getByRole("button", { name: "Térkép törlése" }).click();
      await expect(
        page.getByRole("alertdialog", { name: "Biztosan törlöd a térképet?" }),
      ).toBeVisible();
      await expectClean(page, "törlés megerősítése");
      await page.getByRole("button", { name: "Mégse" }).click();
    });

    test("futásnapló és visszajátszás", async ({ page }) => {
      await login(page);
      await page.getByRole("navigation").getByRole("link", { name: "Futásaim" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Futásaim" })).toBeVisible();
      await page
        .getByRole("link", { name: /^Visszajátszás: / })
        .first()
        .click();
      await expect(page).toHaveURL(/\/runs\/\d+$/);
      await expect(page.getByText(/^Rögzített eredmény: /)).toBeVisible();
      await expectClean(page, "visszajátszás");
    });

    test("ranglista, kézikönyv, futásnapló és felhasználókezelés", async ({ page }) => {
      await loginAs(page, ADMIN);
      await page.getByRole("link", { name: "Ranglista: 1. Egyenes folyosó" }).click();
      await expect(page.getByRole("heading", { level: 1, name: /Ranglista/ })).toBeVisible();
      await expectClean(page, "ranglista");
      await page.getByRole("link", { name: "Kézikönyv" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Kézikönyv" })).toBeVisible();
      await expectClean(page, "kézikönyv");
      await page.getByRole("link", { name: "Receptek: kész programok minden pályához" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Receptek" })).toBeVisible();
      await expectClean(page, "receptek");
      await page.getByRole("navigation").getByRole("link", { name: "Futásaim" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Futásaim" })).toBeVisible();
      await expectClean(page, "futásnapló");
      await page.getByRole("link", { name: "Felhasználók" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Felhasználók" })).toBeVisible();
      await expectClean(page, "felhasználókezelés");
      await page.getByRole("button", { name: "Törlés: demo3" }).click();
      await expect(
        page.getByRole("alertdialog", { name: "Biztosan törlöd a fiókot?" }),
      ).toBeVisible();
      await expectClean(page, "fióktörlés megerősítése");
      await page.getByRole("button", { name: "Mégse" }).click();
    });
  });
}

test.describe("csökkentett mozgás", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  async function runningAnimations(page: Page): Promise<string[]> {
    return page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          return animation.playState === "running" && Number(timing?.duration ?? 0) > 0;
        })
        .map((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          const name = "animationName" in animation ? String(animation.animationName) : "átmenet";
          return `${name} @ ${target?.getAttribute("class") ?? target?.tagName ?? "?"}`;
        }),
    );
  }

  test("prefers-reduced-motion mellett semmi nem animál, lejátszás közben sem", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Bejelentkezés" })).toBeVisible();
    expect(await runningAnimations(page)).toEqual([]);
    await login(page);
    expect(await runningAnimations(page)).toEqual([]);
    await gotoPlay(page, "5. Kígyó");
    await openFromLibrary(page, "Recept – 5. Kígyó");
    await setSpeed(page, "min");
    await setSpeed(page, "max");
    await page.getByRole("button", { name: "Futtatás" }).click();
    for (const steps of [1, 3, 6, 9]) {
      await expect.poll(() => readNumber(page, "Lépés")).toBeGreaterThanOrEqual(steps);
      expect(await runningAnimations(page), `${steps}. lépésnél`).toEqual([]);
    }
    await expect(page.getByText(/A szerver rögzítette/)).toBeVisible();
    expect(await runningAnimations(page)).toEqual([]);
  });
});
