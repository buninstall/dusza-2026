import { expect, type Page, test } from "@playwright/test";
import {
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

async function skipTour(page: Page): Promise<void> {
  await page.addInitScript(() =>
    window.localStorage.setItem("minescript.tour", JSON.stringify({ status: "declined" })),
  );
}

function medal(page: Page) {
  return page.getByRole("region", { name: "Eredmény" });
}

test.describe("bevezető", () => {
  test("először megkérdezi, igen válaszra végigvezet az első pályán", async ({ page }) => {
    await register(page, "tour");
    const prompt = page.getByRole("region", { name: TOUR_PROMPT });
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
    await expect(page.getByRole("heading", { name: "Csillagok és ranglista" })).toBeVisible();
    await expectReadings(page, { gold: 1 });
    await page.getByRole("button", { name: "Kész, megyek bányászni" }).click();
    await expect(page.getByRole("heading", { name: "Csillagok és ranglista" })).toBeHidden();

    await page.goto("/maps");
    await expect(page.getByRole("heading", { level: 1, name: "Pályák" })).toBeVisible();
    await expect(page.getByRole("region", { name: TOUR_PROMPT })).toBeHidden();
  });

  test("nem válaszra eltűnik, és újratöltés után sem kérdez", async ({ page }) => {
    await register(page, "notour");
    const prompt = page.getByRole("region", { name: TOUR_PROMPT });
    await prompt.getByRole("button", { name: "Nem, köszönöm" }).click();
    await expect(prompt).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Pályák" })).toBeVisible();
    await expect(page.getByRole("region", { name: TOUR_PROMPT })).toBeHidden();
  });

  test("a kézikönyvből újraindítható", async ({ page }) => {
    await skipTour(page);
    await register(page, "retour");
    await page.goto("/manual");
    await page.getByRole("button", { name: "Bevezető újrakezdése" }).click();
    await expect(page.getByRole("grid", { name: `${CORRIDOR} térképe` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ez a bánya" })).toBeVisible();
  });
});

test.describe("csillagok, eredmény és tetszés", () => {
  test("a tökéletes futás három csillagot ad, a Pályák oldal is mutatja", async ({ page }) => {
    await skipTour(page);
    await register(page, "stars");
    await gotoPlay(page, CORRIDOR);
    await expect(page.getByText("Célérték: 4 lépés")).toBeVisible();
    await setSpeed(page, "max");
    await replaceProgram(page, BEST_CORRIDOR);
    await runProgram(page);
    await expectFinished(page, 2, 4);
    const result = medal(page);
    await expect(result.getByRole("img", { name: "3 / 3 csillag" })).toBeVisible();
    await expect(result).toContainText("3 új csillag!");
    await expect(result).toContainText("Mind a három csillag megvan.");
    await expect(result.getByRole("link", { name: /^Következő pálya: / })).toBeVisible();
    await expect(page.getByText(/Új egyéni csúcs: \d+\. hely a ranglistán/)).toBeVisible();

    await result.getByRole("button", { name: "Bezárás" }).click();
    await expect(result).toBeHidden();

    await page.goto("/maps");
    const tile = page.getByRole("listitem").filter({ hasText: CORRIDOR });
    await expect(tile.getByRole("img", { name: "3 / 3 csillag" })).toBeVisible();
    await expect(tile).toContainText("2 arany · 4 lépés");
  });

  test("a gyengébb futás csak egy csillagot ad, és megmondja, mi hiányzik", async ({ page }) => {
    await skipTour(page);
    await register(page, "onestar");
    await gotoPlay(page, CORRIDOR);
    await setSpeed(page, "max");
    await replaceProgram(page, "step forward 3\nmine here");
    await runProgram(page);
    await expectFinished(page, 1, 2);
    const result = medal(page);
    await expect(result.getByRole("img", { name: "1 / 3 csillag" })).toBeVisible();
    await expect(result).toContainText("A második csillaghoz mind a 2 elérhető aranyat");
  });

  test("tetszést csak futás után lehet adni, és a Népszerű rendezés előre sorolja", async ({
    page,
  }) => {
    await skipTour(page);
    await register(page, "liker");
    await gotoPlay(page, "3. Kis labirintus");
    const like = page.getByRole("button", { name: /^Tetszik/ });
    await like.click();
    await expect(page.getByText(/Előbb futtass egy programot ezen a pályán/)).toBeVisible();
    await expect(like).toHaveAttribute("aria-pressed", "false");

    await setSpeed(page, "max");
    await replaceProgram(page, "print 1");
    await runProgram(page);
    await expectFinished(page, 0, 1);
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(like).toContainText("1");

    await page.goto("/maps?sort=popular");
    const first = page.getByRole("list", { name: "Pályák listája" }).getByRole("listitem").first();
    await expect(first).toContainText("3. Kis labirintus");
    await expect(first).toContainText("1 tetszés");
  });
});

test.describe("töréspont és nyomvonal", () => {
  test("a sorszámra kattintva a futás megáll a jelölt sornál", async ({ page }) => {
    await skipTour(page);
    await register(page, "breaker");
    await gotoPlay(page, CORRIDOR);
    await setSpeed(page, "max");
    await replaceProgram(page, "step forward 1\nstep forward 1\nstep forward 1");
    await page.locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^2$/ }).click();
    await expect(page.locator(".cm-breakpoint")).toHaveCount(2);
    await runProgram(page);
    await expectReadings(page, { status: "Szünet", steps: 2 });
    await expect(page.getByText("Megállt a 2. sor töréspontján.")).toBeVisible();
    await expect(page.locator('.board-fx[data-fx="trail"]')).toHaveCount(2);
    await page
      .getByRole("region", { name: "Lejátszásvezérlés" })
      .getByRole("button", {
        name: /^Folytatás/,
      })
      .click();
    await expectFinished(page, 0, 3);
  });

  test("F9 a kurzor sorára tesz töréspontot", async ({ page }) => {
    await skipTour(page);
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

test.describe("napi kihívás", () => {
  test("a napi pálya mindenkinek közös, nem szerkeszthető, és van ranglistája", async ({
    page,
  }) => {
    await skipTour(page);
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
  test("generálás, falkeret és próbajáték mentés nélkül", async ({ page }) => {
    await skipTour(page);
    await register(page, "builder");
    await page.goto("/maps/new");
    await page.getByRole("button", { name: "Generálás" }).click();
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

    await page.getByRole("button", { name: "Falkeret" }).click();
    await expect(page.getByText("A térkép szélére fal került.")).toBeVisible();

    let posted = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/runs")) {
        posted += 1;
      }
    });
    await page.getByRole("button", { name: "Próbajáték" }).click();
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
    await skipTour(page);
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
    await expect(page.getByText(/Célérték: \d+ lépés/)).toBeVisible();
  });
});

test.describe("megosztható visszajátszás", () => {
  test("a ranglistáról bárki megnézheti más futását, kóddal együtt", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await skipTour(page);
    await loginAs(page, { username: "demo2", password: "demo2026" });
    await page.goto("/maps");
    await page.getByRole("link", { name: `Ranglista: ${CORRIDOR}`, exact: true }).click();
    await page.getByRole("link", { name: /^demo1 futásának visszajátszása$/ }).click();
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
    await skipTour(page);
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
