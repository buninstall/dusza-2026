import { expect, type Page, test } from "@playwright/test";
import {
  articleFor,
  cell,
  editor,
  executedLine,
  expectFinished,
  expectReadings,
  expectRuntimeError,
  finishedReport,
  gotoPlay,
  importProgramFile,
  instruments,
  login,
  mapGrid,
  openConsole,
  openFromLibrary,
  openLeaderboardFromPlay,
  pickView,
  readNumber,
  register,
  replaceProgram,
  runtimeErrorReport,
  setSpeed,
  speedSlider,
  stoppedReport,
  syntaxReport,
  transport,
} from "./helpers.ts";
import {
  ERROR_RECIPES,
  LIMIT_RECIPE,
  LOOP_RECIPE,
  OPTIMAL_RECIPES,
  recipePath,
  recipeText,
  SYNTAX_RECIPE,
} from "./recipes.ts";

const CORRIDOR = "1. Egyenes folyosó";
const SLOW_TICK_MS = 800;
const FAST_FINISH_MS = 15_000;

async function run(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Futtatás" }).click();
}

async function rewind(page: Page): Promise<void> {
  const restart = transport(page, "Elejére");
  if (await restart.isEnabled()) {
    await restart.click();
  }
  await expect(restart).toBeDisabled();
}

async function stepGapMs(page: Page): Promise<number> {
  return instruments(page).evaluate(
    (region) =>
      new Promise<number>((resolve) => {
        const read = () => /Lépés\s*(\d+)/.exec(region.textContent ?? "")?.[1] ?? "";
        const stamps: number[] = [];
        let last = read();
        const observer = new MutationObserver(() => {
          const now = read();
          if (now === last) {
            return;
          }
          last = now;
          stamps.push(performance.now());
          if (stamps.length === 2) {
            observer.disconnect();
            resolve((stamps[1] ?? 0) - (stamps[0] ?? 0));
          }
        });
        observer.observe(region, { subtree: true, childList: true, characterData: true });
      }),
  );
}

test.describe("3.4 futtatás a bemutató fiókkal", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("minden optimális recept a saját pályáján pontos arannyal és lépésszámmal fut le", async ({
    page,
  }) => {
    test.slow();
    for (const recipe of [...OPTIMAL_RECIPES, LOOP_RECIPE]) {
      await gotoPlay(page, recipe.map);
      await openFromLibrary(page, recipe.library);
      await setSpeed(page, "max");
      await run(page);
      await expectFinished(page, recipe.gold, recipe.steps);
      await expectReadings(page, {
        gold: recipe.gold,
        goldTotal: recipe.goldTotal,
        steps: recipe.steps,
        status: "Kész",
      });
    }
    await openConsole(page);
    await expect(page.getByRole("log", { name: "Konzol" })).toContainText("2");
  });

  test("lassított lejátszás: az éppen végrehajtott sor kiemelve, a műszerek és a robot élőben", async ({
    page,
  }) => {
    await gotoPlay(page, "2. Az első kanyar");
    await openFromLibrary(page, "Recept – 2. Az első kanyar");
    await setSpeed(page, "min");
    await run(page);
    await expectReadings(page, { status: "Fut" });
    await expect(editor(page)).toHaveAttribute("aria-readonly", "true");
    await transport(page, "Szünet").click();
    await expectReadings(page, { status: "Szünet" });
    await rewind(page);
    await expectReadings(page, { gold: 0, goldTotal: 2, steps: 0, line: null, row: 1, col: 1 });
    await expect(executedLine(page)).toHaveCount(0);

    const step = transport(page, "Egy sor előre");
    await step.click();
    await expectReadings(page, { steps: 1, line: 1, row: 1, col: 5, dir: "kelet", gold: 0 });
    await expect(executedLine(page)).toHaveText("step forward 4");
    await expect(cell(page, 1, 5)).toHaveAccessibleName(
      "1. sor, 5. oszlop: robot, kelet felé, aranyon áll",
    );

    await step.click();
    await expectReadings(page, { steps: 2, line: 2, gold: 1 });
    await expect(executedLine(page)).toHaveText("mine here");
    await expect(cell(page, 1, 5)).toHaveAccessibleName("1. sor, 5. oszlop: robot, kelet felé");

    await step.click();
    await expectReadings(page, { steps: 3, line: 3, row: 1, col: 5, dir: "dél" });
    await expect(executedLine(page)).toHaveText("turn by 3");
    await expect(cell(page, 1, 5)).toHaveAccessibleName("1. sor, 5. oszlop: robot, dél felé");

    await step.click();
    await expectReadings(page, { steps: 4, line: 4, row: 4, col: 5, dir: "dél" });
    await expect(executedLine(page)).toHaveText("step forward 3");
    await expect(cell(page, 4, 5)).toHaveAccessibleName(
      "4. sor, 5. oszlop: robot, dél felé, aranyon áll",
    );

    await transport(page, "Egy sor vissza").click();
    await expectReadings(page, { steps: 3, line: 3, row: 1, col: 5, dir: "dél" });
    await expect(executedLine(page)).toHaveText("turn by 3");

    await transport(page, "Folytatás").click();
    await expectFinished(page, 2, 5);
    await expectReadings(page, { gold: 2, goldTotal: 2, steps: 5, row: 4, col: 5, status: "Kész" });
    await expect(editor(page)).not.toHaveAttribute("aria-readonly", "true");
  });

  test("a sebesség állítható: 1 sor/s mellett lassan lép, maximumra állítva gyorsan végez", async ({
    page,
  }) => {
    await gotoPlay(page, CORRIDOR);
    await openFromLibrary(page, LOOP_RECIPE.library);
    await setSpeed(page, "min");
    await expect(speedSlider(page)).toHaveAttribute("aria-valuetext", "1 sor/s");
    const gap = stepGapMs(page);
    await run(page);
    expect(await gap).toBeGreaterThanOrEqual(SLOW_TICK_MS);
    await expectReadings(page, { status: "Fut" });

    await setSpeed(page, "max");
    await expect(speedSlider(page)).toHaveAttribute("aria-valuetext", "30 sor/s");
    await expect(finishedReport(page)).toBeVisible({
      timeout: FAST_FINISH_MS,
    });
    await expectFinished(page, LOOP_RECIPE.gold, LOOP_RECIPE.steps);
  });

  test("futtatáskor a térkép és a robot alaphelyzetbe kerül, a második futás is az elejéről indul", async ({
    page,
  }) => {
    await gotoPlay(page, CORRIDOR);
    await openFromLibrary(page, "Recept – 1. Egyenes folyosó");
    await setSpeed(page, "max");
    await run(page);
    await expectFinished(page, 2, 4);
    await expectReadings(page, { gold: 2, row: 1, col: 7, dir: "kelet" });
    await expect(cell(page, 1, 4)).toHaveAccessibleName(
      "1. sor, 4. oszlop: üres kamra, kibányászva",
    );

    await setSpeed(page, "min");
    await run(page);
    await transport(page, "Szünet").click();
    await rewind(page);
    await expectReadings(page, { gold: 0, steps: 0, line: null, row: 1, col: 1, dir: "kelet" });
    await expect(cell(page, 1, 1)).toHaveAccessibleName("1. sor, 1. oszlop: robot, kelet felé");
    await expect(cell(page, 1, 4)).toHaveAccessibleName("1. sor, 4. oszlop: felderítetlen");
    await pickView(page, "Teljes térkép");
    await expect(cell(page, 1, 4)).toHaveAccessibleName(
      "1. sor, 4. oszlop: arany, még nem felfedezett",
    );
    await transport(page, "Ugrás a végére").click();
    await expectFinished(page, 2, 4);
  });

  test("a bejárt és az isThere által vizsgált mező felfedezett, a többi megkülönböztetve felderítetlen", async ({
    page,
  }) => {
    await gotoPlay(page, CORRIDOR);
    await replaceProgram(page, "set elol to isThere 0\nstep forward 2\nset arany to isThere 2\n");
    await setSpeed(page, "max");
    await run(page);
    await expectFinished(page, 0, 3);
    const expected = [
      "1. sor, 1. oszlop: üres kamra",
      "1. sor, 2. oszlop: üres kamra",
      "1. sor, 3. oszlop: robot, kelet felé",
      "1. sor, 4. oszlop: arany",
      "1. sor, 5. oszlop: felderítetlen",
      "1. sor, 6. oszlop: felderítetlen",
      "1. sor, 7. oszlop: felderítetlen",
      "1. sor, 8. oszlop: felderítetlen",
    ];
    const cells = mapGrid(page).getByRole("gridcell");
    await expect(cells).toHaveCount(expected.length);
    for (const [index, name] of expected.entries()) {
      await expect(cells.nth(index)).toHaveAccessibleName(name);
    }
    await pickView(page, "Teljes térkép");
    await expect(cell(page, 1, 4)).toHaveAccessibleName("1. sor, 4. oszlop: arany");
    await expect(cell(page, 1, 6)).toHaveAccessibleName(
      "1. sor, 6. oszlop: üres kamra, még nem felfedezett",
    );
    await expect(cell(page, 1, 7)).toHaveAccessibleName(
      "1. sor, 7. oszlop: arany, még nem felfedezett",
    );
  });

  test("minden futásidejű hibapróba a helyes hibakódot, sort és lépésszámot mutatja", async ({
    page,
  }) => {
    test.slow();
    await gotoPlay(page, CORRIDOR);
    await setSpeed(page, "max");
    for (const recipe of ERROR_RECIPES) {
      await openFromLibrary(page, recipe.library);
      await run(page);
      await expectRuntimeError(page, recipe.code, recipe.line, recipe.steps);
      await expectReadings(page, { steps: recipe.steps, status: "Hiba" });
      await page
        .getByRole("button", { name: `Mutasd ${articleFor(recipe.line)} ${recipe.line}. sort` })
        .click();
      await expect(editor(page)).toBeFocused();
    }
  });

  test("az INSTRUCTION_COUNT_LIMIT_EXCEEDED csak az 1000. feldolgozott sor után jelenik meg", async ({
    page,
  }) => {
    await gotoPlay(page, CORRIDOR);
    await openFromLibrary(page, LIMIT_RECIPE.library);
    await setSpeed(page, "max");
    await run(page);
    await expect.poll(() => readNumber(page, "Lépés")).toBeGreaterThanOrEqual(30);
    await expectReadings(page, { status: "Fut" });
    await expect(runtimeErrorReport(page, LIMIT_RECIPE.line)).toHaveCount(0);
    await expect(page.getByText(`${LIMIT_RECIPE.code} ·`)).toHaveCount(0);
    await transport(page, "Ugrás a végére").click();
    await expectRuntimeError(page, LIMIT_RECIPE.code, LIMIT_RECIPE.line, LIMIT_RECIPE.steps);
    await expectReadings(page, { steps: 1000, status: "Hiba" });
  });
});

test.describe("3.4 futtatás új fiókkal", () => {
  test("szintaktikailag hibás program nem fut, minden hibás sora jelölve, semmi nem rögzül", async ({
    page,
  }) => {
    await register(page, "szintaxis");
    await gotoPlay(page, CORRIDOR);
    await replaceProgram(page, recipeText(SYNTAX_RECIPE.file));
    await run(page);
    const report = syntaxReport(page);
    await expect(report).toContainText("Hibás sorok: 1, 2, 3, 4.");
    const diagnostics = page.getByRole("region", { name: /^Hibalista/ });
    await expect(diagnostics).toHaveAccessibleName(/4 hiba/);
    for (const line of SYNTAX_RECIPE.lines) {
      await expect(
        diagnostics.getByRole("button", {
          name: new RegExp(`^Ugrás az? ${line}\\. sorra, hiba`),
        }),
      ).toBeVisible();
    }
    await expectReadings(page, { steps: 0, line: null, status: "Hibás program" });
    await report.getByRole("button", { name: "Mutasd az 1. sort" }).click();
    await expect(editor(page)).toBeFocused();
    await page.getByRole("link", { name: "Futásaim" }).click();
    await expect(page.getByText("Még nincs rögzített futásod.", { exact: false })).toBeVisible();
  });

  test("a futás leállítható, a leállított futás nem kerül a ranglistára", async ({ page }) => {
    const account = await register(page, "megallo");
    await gotoPlay(page, CORRIDOR);
    await importProgramFile(page, recipePath(LIMIT_RECIPE.file));
    await setSpeed(page, "max");
    await run(page);
    await expect.poll(() => readNumber(page, "Lépés")).toBeGreaterThanOrEqual(5);
    await transport(page, "Leállítás").click();
    await expect(stoppedReport(page)).toContainText("A leállított futás nem kerül a ranglistára.");
    await expectReadings(page, { status: "Leállítva" });
    await expect(transport(page, "Leállítás")).toHaveCount(0);
    await expect(transport(page, "Futtatás")).toBeEnabled();
    await expect(editor(page)).not.toHaveAttribute("aria-readonly", "true");
    await expect(page.getByText(/A szerver rögzítette/)).toHaveCount(0);

    await openLeaderboardFromPlay(page);
    await expect(
      page.getByRole("heading", { level: 1, name: `Ranglista – ${CORRIDOR}` }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("rowheader", { name: new RegExp(account.username) })).toHaveCount(
      0,
    );
    await page.getByRole("link", { name: "Futásaim" }).click();
    await expect(page.getByText("Még nincs rögzített futásod.", { exact: false })).toBeVisible();
  });
});
