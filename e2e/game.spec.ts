import { expect, type Page, test } from "@playwright/test";
import {
  allowTourPrompt,
  editor,
  expectFinished,
  expectReadings,
  gotoPlay,
  loginAs,
  register,
  replaceProgram,
  runProgram,
  setSpeed,
} from "./helpers.ts";

const CORRIDOR = "1. Egyenes folyosó";
const BEST_CORRIDOR = "step forward 3\nmine here\nstep forward 3\nmine here";
const TOUR_PROMPT = "Kérsz egy rövid bevezetőt?";

async function storedTour(page: Page): Promise<unknown> {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem("minescript.tour") ?? "null"));
}

async function tabIntoEditor(page: Page): Promise<void> {
  for (let press = 0; press < 30; press += 1) {
    if (await editor(page).evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("A szerkesztő billentyűzettel nem érhető el.");
}

function medal(page: Page) {
  return page.getByRole("region", { name: "Eredmény" });
}

test.describe("bevezető", () => {
  test("először megkérdezi, igen válaszra végigvezet az első pályán", async ({ page }) => {
    await register(page, "tour");
    await allowTourPrompt(page);
    await page.goto("/maps");
    const prompt = page.getByRole("dialog", { name: TOUR_PROMPT });
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Igen, mutasd" }).click();
    await expect(page.getByRole("grid", { name: `${CORRIDOR} térképe` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ez a bánya" })).toBeVisible();
    await setSpeed(page, "max");
    await page.getByRole("button", { name: "Tovább" }).click();
    await page.getByRole("button", { name: "Beírom: step forward 3" }).click();
    await expect(editor(page)).toHaveText("step forward 3");
    await expect(page.getByRole("heading", { name: "Indítsd el!" })).toBeVisible();
    await page.getByRole("button", { name: "Futtatás" }).click();
    await expect(
      page.getByRole("heading", { name: /A robot odament, de nem bányászott/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Beírom: mine here" }).click();
    await expect(editor(page)).toHaveText("step forward 3mine here");
    await expect(page.getByRole("heading", { name: "Futtasd újra" })).toBeVisible();
    await page.getByRole("button", { name: "Futtatás" }).click();
    await expect(page.getByRole("heading", { name: "Rögök és ranglista" })).toBeVisible();
    await expectReadings(page, { gold: 1 });
    await page.getByRole("button", { name: "Kész, megyek bányászni" }).click();
    await expect(page.getByRole("heading", { name: "Rögök és ranglista" })).toBeHidden();
    expect(await storedTour(page)).toEqual({ status: "done" });
  });

  test("nem válaszra eltűnik, és az oldalon belül sem kérdez újra", async ({ page }) => {
    await register(page, "notour");
    await allowTourPrompt(page);
    await page.goto("/maps");
    const prompt = page.getByRole("dialog", { name: TOUR_PROMPT });
    await prompt.getByRole("button", { name: "Nem, köszönöm" }).click();
    await expect(prompt).toBeHidden();
    expect(await storedTour(page)).toEqual({ status: "declined" });
    await page.getByRole("link", { name: "Kézikönyv" }).click();
    await page.getByRole("navigation").getByRole("link", { name: "Pályák" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pályák" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: TOUR_PROMPT })).toBeHidden();
  });

  test("a kézikönyvből újraindítható", async ({ page }) => {
    await register(page, "retour");
    await page.goto("/manual");
    await page.getByRole("button", { name: "Bevezető újrakezdése" }).click();
    await expect(page.getByRole("grid", { name: `${CORRIDOR} térképe` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ez a bánya" })).toBeVisible();
  });
});

test.describe("rögök és eredmény", () => {
  test("a tökéletes futás három rögöt ad, a Pályák oldal is mutatja", async ({ page }) => {
    await register(page, "stars");
    await gotoPlay(page, CORRIDOR);
    await expect(page.getByText("Cél: 4 lépés")).toBeVisible();
    await setSpeed(page, "max");
    await replaceProgram(page, BEST_CORRIDOR);
    await runProgram(page);
    await expectFinished(page, 2, 4);
    const result = medal(page);
    await expect(result.getByRole("img", { name: "3 / 3 rög" })).toBeVisible();
    await expect(result).toContainText("3 új rög!");
    await expect(result).toContainText("Mind a három rög megvan.");
    await expect(result.getByRole("link", { name: /^Következő pálya: / })).toBeVisible();

    await result.getByRole("button", { name: "Bezárás" }).click();
    await expect(result).toBeHidden();

    await page.goto("/maps");
    const tile = page.getByRole("listitem").filter({ hasText: CORRIDOR });
    await expect(tile.getByRole("img", { name: "3 / 3 rög" })).toBeVisible();
    await expect(tile).toContainText("2 arany · 4 lépés");
  });

  test("a gyengébb futás csak egy rögöt ad, és megmondja, mi hiányzik", async ({ page }) => {
    await register(page, "onestar");
    await gotoPlay(page, CORRIDOR);
    await setSpeed(page, "max");
    await replaceProgram(page, "step forward 3\nmine here");
    await runProgram(page);
    await expectFinished(page, 1, 2);
    const result = medal(page);
    await expect(result.getByRole("img", { name: "1 / 3 rög" })).toBeVisible();
    await expect(result).toContainText("A második röghöz bányászd ki mind a 2 elérhető aranyat");
  });
});

test.describe("töréspont és nagyítás", () => {
  test("a sorszámra kattintva a futás megáll a jelölt sornál", async ({ page }) => {
    await register(page, "breaker");
    await gotoPlay(page, CORRIDOR);
    await setSpeed(page, "max");
    await replaceProgram(page, "step forward 1\nstep forward 1\nstep forward 1");
    await page.locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^2$/ }).click();
    await expect(page.locator(".cm-breakpoint")).toHaveCount(2);
    await runProgram(page);
    await expectReadings(page, { status: "Szünet", steps: 2 });
    await expect(page.getByText("Megállt a 2. sor töréspontján.")).toBeVisible();
    await page
      .getByRole("region", { name: "Lejátszásvezérlés" })
      .getByRole("button", {
        name: /^Folytatás/,
      })
      .click();
    await expectFinished(page, 0, 3);
  });

  test("a térkép nagyítható, és a konzol csak kérésre jelenik meg", async ({ page }) => {
    await register(page, "zoom");
    await gotoPlay(page, "8. A nagy bánya");
    const zoom = page.getByRole("toolbar", { name: "Térkép nagyítása" });
    await expect(zoom).toContainText("100%");
    await zoom.getByRole("button", { name: "Nagyítás" }).click();
    await expect(zoom).toContainText("125%");
    await zoom.getByRole("button", { name: "Kicsinyítés" }).click();
    await expect(zoom).toContainText("100%");
    await expect(page.getByRole("log", { name: "Konzol" })).toBeHidden();
    await setSpeed(page, "max");
    await replaceProgram(page, "print 1\nprint 2");
    await runProgram(page);
    await expectFinished(page, 0, 2);
    const toggle = page.getByRole("button", { name: /^Konzol/ });
    await expect(toggle).toContainText("2");
    await toggle.click();
    await expect(page.getByRole("log", { name: "Konzol" })).toContainText("2");
  });

  test("F9 a kurzor sorára tesz töréspontot", async ({ page }) => {
    await register(page, "fkey");
    await gotoPlay(page, CORRIDOR);
    await setSpeed(page, "max");
    await replaceProgram(page, "print 1\nprint 2\nprint 3");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("F9");
    await expect(page.locator(".cm-breakpoint")).toHaveCount(2);
    await runProgram(page);
    await expectReadings(page, { status: "Szünet", steps: 2 });
  });
});

test.describe("elrendezés és térkép", () => {
  test("a program balra, a bánya jobbra van, és a határ húzható, újratöltés után is megmarad", async ({
    page,
  }) => {
    await register(page, "split");
    await gotoPlay(page, CORRIDOR);
    const program = page.getByRole("region", { name: "Program" });
    const stage = page.getByRole("region", { name: "Bánya" });
    const programBox = await program.boundingBox();
    const stageBox = await stage.boundingBox();
    expect(programBox && stageBox && programBox.x + programBox.width <= stageBox.x).toBe(true);

    const handle = page.getByRole("separator", { name: "A szerkesztő és a bánya határa" });
    const before = Number(await handle.getAttribute("aria-valuenow"));
    const box = await handle.boundingBox();
    if (!box) throw new Error("Nincs határvonal.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    const after = Number(await handle.getAttribute("aria-valuenow"));
    expect(after).toBeGreaterThan(before);
    const widened = (await program.boundingBox())?.width ?? 0;
    expect(widened).toBeGreaterThan(programBox?.width ?? 0);

    await page.reload();
    await expect(handle).toHaveAttribute("aria-valuenow", String(after));
    await handle.focus();
    await page.keyboard.press("Home");
    await expect(handle).toHaveAttribute("aria-valuenow", "24");
    await handle.dblclick();
    await expect(handle).toHaveAttribute("aria-valuenow", String(before));
  });

  test("görgővel a kurzor körül nagyít, a nagyított térkép húzható", async ({ page }) => {
    await register(page, "wheel");
    await gotoPlay(page, "8. A nagy bánya");
    const zoom = page.getByRole("toolbar", { name: "Térkép nagyítása" });
    const board = await page.locator(".well-view .board").boundingBox();
    if (!board) throw new Error("Nincs térkép.");
    const middle = await page.evaluate(
      ({ x, y }) => {
        const found = document
          .elementsFromPoint(x, y)
          .find((element) => element.hasAttribute("data-row"));
        return found
          ? { row: found.getAttribute("data-row"), col: found.getAttribute("data-col") }
          : null;
      },
      { x: board.x + board.width / 2, y: board.y + board.height / 2 },
    );
    if (!middle) throw new Error("Nincs középső mező.");
    const target = page.locator(`.well-view [data-row="${middle.row}"][data-col="${middle.col}"]`);
    const start = await target.boundingBox();
    if (!start) throw new Error("Nincs középső mező.");
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -300);
    await expect(zoom).not.toContainText("100%");
    await expect
      .poll(async () => {
        const moved = await target.boundingBox();
        return moved
          ? Math.round(Math.hypot(moved.x + moved.width / 2 - x, moved.y + moved.height / 2 - y))
          : 999;
      })
      .toBeLessThanOrEqual(4);
    expect((await target.boundingBox())?.width ?? 0).toBeGreaterThan(start.width);
    await page.mouse.wheel(0, -300);
    await page.mouse.wheel(0, -300);
    const well = page.locator(".well-view");
    const offset = () =>
      well.evaluate((element) => Math.round(element.scrollLeft + element.scrollTop));
    const before = await offset();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 80, y - 60, { steps: 5 });
    await page.mouse.up();
    await expect.poll(offset).not.toBe(before);
  });

  test("a konzol és a nagyítás váltása nem játssza le újra az aranygyűjtést", async ({ page }) => {
    await page.addInitScript(() => {
      const original = Element.prototype.animate;
      const counter = window as unknown as { goldFlights: number };
      counter.goldFlights = 0;
      Element.prototype.animate = function animate(this: Element, ...args) {
        if (this.classList.contains("gold-flight")) {
          counter.goldFlights += 1;
        }
        return original.apply(this, args);
      };
    });
    await register(page, "replayfx");
    await gotoPlay(page, CORRIDOR);
    await setSpeed(page, "min");
    await replaceProgram(page, "step forward 3\nmine here");
    await runProgram(page);
    await expectFinished(page, 1, 2);
    const flights = () =>
      page.evaluate(() => (window as unknown as { goldFlights: number }).goldFlights);
    const settled = await flights();
    expect(settled).toBe(1);
    const toggle = page.getByRole("button", { name: /^Konzol/ });
    await toggle.click();
    await toggle.click();
    const zoom = page.getByRole("toolbar", { name: "Térkép nagyítása" });
    await zoom.getByRole("button", { name: "Nagyítás" }).click();
    await zoom.getByRole("button", { name: "Kicsinyítés" }).click();
    expect(await flights()).toBe(settled);
  });

  test("egérrel a szerkesztőnek nincs fókuszkerete, billentyűzettel van", async ({ page }) => {
    await register(page, "ring");
    await gotoPlay(page, CORRIDOR);
    const content = editor(page);
    const outline = () => content.evaluate((element) => getComputedStyle(element).outlineStyle);
    await content.click();
    await expect(content).toBeFocused();
    await expect(page.locator(".cm-editor.cm-focused")).toHaveCount(1);
    expect(await outline()).toBe("none");
    await page.getByRole("button", { name: "Programtár" }).focus();
    await page.keyboard.press("Tab");
    await tabIntoEditor(page);
    await expect.poll(outline).not.toBe("none");
  });
});

test.describe("napi kihívás", () => {
  test("a napi pálya mindenkinek közös, nem szerkeszthető, és van ranglistája", async ({
    page,
  }) => {
    await register(page, "daily");
    const card = page.getByRole("region", { name: "Napi kihívás" });
    await expect(card).toBeVisible();
    await card.getByRole("link", { name: "Játék a napi pályán" }).click();
    await expect(page.getByRole("grid", { name: /^Napi kihívás · .* térképe$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Térkép szerkesztése" })).toBeHidden();
    const playUrl = page.url();

    await page.goto("/maps");
    await page
      .getByRole("region", { name: "Napi kihívás" })
      .getByRole("link", { name: "Napi ranglista" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Ranglista – Napi kihívás/ }),
    ).toBeVisible();
    const mapId = playUrl.split("/").at(-1);
    await page.goto(`/maps/${mapId}/edit`);
    await expect(
      page.getByText("Ezt a térképet csak a készítője vagy egy adminisztrátor szerkesztheti."),
    ).toBeVisible();
  });
});

test.describe("térképszerkesztő extrák", () => {
  test("generálás, falkeret és kipróbálás mentés nélkül", async ({ page }) => {
    await register(page, "builder");
    await page.goto("/maps/new");
    await page.getByRole("button", { name: "Továbbiak" }).click();
    await page.getByRole("menuitem", { name: "Generálás…" }).click();
    const dialog = page.getByRole("dialog", { name: "Pálya generálása" });
    await dialog.getByRole("radio", { name: "Könnyű" }).check({ force: true });
    await dialog.getByRole("button", { name: "Generálás" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page
        .getByRole("region", { name: "Értesítések" })
        .getByText(/Új pálya generálva, célérték: \d+ lépés\./),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Célérték (lépés)" })).not.toHaveValue("");
    const gold = page.getByRole("gridcell", { name: /: arany$/ });
    expect(await gold.count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Továbbiak" }).click();
    await page.getByRole("menuitem", { name: "Falkeret" }).click();
    await expect(page.getByText("A térkép szélére fal került.")).toBeAttached();

    let posted = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/runs")) {
        posted += 1;
      }
    });
    await page.getByRole("button", { name: "Kipróbálás" }).click();
    await expect(page.getByRole("grid", { name: "Mentetlen térkép térképe" })).toBeVisible();
    await setSpeed(page, "max");
    await replaceProgram(page, "print 1");
    await runProgram(page);
    await expect(
      page.getByText("Próbafutás: az eredmény nem kerül a ranglistára.").last(),
    ).toBeVisible();
    await expect(page.getByText(/A szerver rögzítette/)).toBeHidden();
    expect(posted).toBe(0);
    await page.getByRole("button", { name: "Vissza a szerkesztőbe" }).click();
    await expect(page.getByRole("grid", { name: "Térképrács" })).toBeVisible();
  });

  test("a gépi megoldás kiszámolja a célértéket, és mentés után a pálya hirdeti", async ({
    page,
  }) => {
    await register(page, "par");
    await page.goto("/maps/new");
    await page.getByRole("textbox", { name: "Cím" }).fill("Célérték pálya");
    await page.getByRole("gridcell", { name: "1. sor, 4. oszlop: üres kamra" }).click();
    await page.getByRole("radio", { name: /Arany/ }).check({ force: true });
    await page.getByRole("gridcell", { name: "1. sor, 4. oszlop: fal" }).click();
    await page.getByRole("button", { name: "Gépi megoldás" }).click();
    await expect(page.getByText(/A gép megoldása \d+ lépés\./)).toBeVisible();
    await page.getByRole("button", { name: /^Mentés/ }).click();
    await expect(page).toHaveURL(/\/maps\/\d+\/edit/);
    await page.getByRole("link", { name: "Kipróbálás" }).click();
    await expect(page.getByText(/Cél: \d+ lépés/)).toBeVisible();
  });
});

test.describe("megosztható visszajátszás", () => {
  test("a ranglistáról bárki megnézheti más futását, kóddal együtt", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loginAs(page, { username: "demo2", password: "demo2026" });
    await page.goto("/maps");
    await page.getByRole("link", { name: `Ranglista: ${CORRIDOR}`, exact: true }).click();
    await page.getByRole("link", { name: "Megnézem: demo1 futása", exact: true }).click();
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(page.getByText("demo1 futása")).toBeVisible();
    await expect(editor(page)).not.toHaveText("");
    await page.getByRole("button", { name: "Link másolása" }).click();
    await expect(page.getByText("A link a vágólapra került.")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(page.url());
  });
});

test.describe("hang", () => {
  test("a némítás a fejlécben kapcsolható, és újratöltés után megmarad", async ({ page }) => {
    await register(page, "sound");
    const toggle = page.getByRole("button", { name: "Hangeffektek" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(page.getByRole("button", { name: "Hangeffektek" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
