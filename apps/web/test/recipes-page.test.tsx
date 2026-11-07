import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { MAP_RECIPES, normaliseMap, recipeText } from "../src/recipes/catalog.ts";
import { respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { mapDetail, mapSummary } from "./support/fixtures.ts";

const CORRIDOR = recipeText("palyak/01-egyenes-folyoso.txt");
const RECIPE = recipeText("01-egyenes-folyoso.ms");
const STORAGE_KEY = "minescript.program.1";

function editorText(): string {
  return [...document.querySelectorAll(".cm-line")].map((line) => line.textContent).join("\n");
}

function openCorridor(search: string) {
  respond("GET", "/maps/1", mapDetail(1, "1. Egyenes folyosó", CORRIDOR));
  return renderApp(`/play/1${search}`);
}

describe("receptek oldal", () => {
  test("a pályához illesztett recept megnyitható, a hiányzó pályáé letiltva, minden letölthető", async () => {
    respond("GET", "/maps", { maps: [mapSummary(1, "1. Egyenes folyosó", CORRIDOR)] });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:recipe");
    URL.revokeObjectURL = vi.fn();
    const { user } = renderApp("/manual/receptek");
    const open = await screen.findByRole("link", { name: "Megnyitás: 01-egyenes-folyoso.ms" });
    expect(open.getAttribute("href")).toBe("/play/1?recept=01-egyenes-folyoso");
    const missing = MAP_RECIPES.filter(
      (recipe) => normaliseMap(recipeText(recipe.mapFile)) !== normaliseMap(CORRIDOR),
    );
    expect(screen.getAllByText("Ez a pálya nincs az adatbázisban.").length).toBe(missing.length);
    expect(screen.getByRole("heading", { level: 2, name: "Homokozó bemutatók" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Hibapróbák" })).toBeTruthy();
    const errors = screen.getByRole("table", { name: "Hibapróbák" });
    expect(within(errors).getByText("E_INT_OVERFLOW")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Hibás térképek" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "ket-robot.txt letöltése" }));
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});

describe("recept betöltése a játékba", () => {
  test("üres szerkesztőbe kérdés nélkül betölt, a paraméter eltűnik", async () => {
    const { router } = openCorridor("?recept=01-egyenes-folyoso");
    await waitFor(() => expect(editorText()).toBe(RECIPE));
    expect(await screen.findByText(/„1. Egyenes folyosó” recept betöltve/)).toBeTruthy();
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").source).toBe(RECIPE);
  });

  test("nem mentett munkánál megerősítést kér; a Mégse megtartja a programot", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ source: "print 7\n", linked: null }));
    const { user, router } = openCorridor("?recept=e-no-gold");
    const dialog = await screen.findByRole("alertdialog", {
      name: "Felülírod a szerkesztő tartalmát?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Mégse" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(editorText()).toBe("print 7\n");
  });

  test("megerősítés után a recept kerül a szerkesztőbe", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ source: "print 7\n", linked: null }));
    const { user } = openCorridor("?recept=e-no-gold");
    const dialog = await screen.findByRole("alertdialog", {
      name: "Felülírod a szerkesztő tartalmát?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Megnyitás" }));
    await waitFor(() => expect(editorText()).toBe(recipeText("hibak/e-no-gold.ms")));
  });

  test("ismeretlen recept nevét csendben eldobja", async () => {
    const { router } = openCorridor("?recept=nincs-ilyen");
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("kézikönyv", () => {
  test("fejezetválasztó és rejtett bejárat a receptekhez", async () => {
    renderApp("/manual");
    const chapters = await screen.findByRole("navigation", { name: "Tartalom" });
    const first = within(chapters).getByRole("link", { name: /A játék röviden/ });
    await waitFor(() => expect(first.getAttribute("aria-current")).toBe("page"));
    const entry = screen.getByRole("link", { name: "Receptek: kész programok minden pályához" });
    expect(entry.getAttribute("href")).toBe("/manual/receptek");
    expect(screen.getByRole("heading", { level: 1, name: "Kézikönyv" })).toBeTruthy();
  });

  test("az előző és a következő fejezet egy kattintásra elérhető", async () => {
    const { router } = renderApp("/manual#terkep");
    const pager = await screen.findByRole("navigation", { name: "Lapozás a fejezetek között" });
    expect(within(pager).getByRole("link", { name: /^Előző\s*Az első program$/ })).toBeTruthy();
    const user = userEvent.setup();
    await user.click(
      within(pager).getByRole("link", {
        name: /^Következő\s*Sötét bányák: Lámpafény és Vaksötét$/,
      }),
    );
    await waitFor(() => expect(router.state.location.hash).toBe("lampafeny"));
    const heading = await screen.findByRole("heading", { level: 2, name: /Sötét bányák/ });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  test("az első fejezetnek nincs előzője", async () => {
    renderApp("/manual");
    const pager = await screen.findByRole("navigation", { name: "Lapozás a fejezetek között" });
    expect(within(pager).getAllByRole("link")).toHaveLength(1);
    expect(
      within(pager).getByRole("link", { name: /^Következő\s*Homokozó és Történet$/ }),
    ).toBeTruthy();
  });

  test("a fejezet próbapadja lejátssza a példát a mini pályán", async () => {
    renderApp("/manual");
    const chapters = await screen.findByRole("navigation", { name: "Tartalom" });
    const user = userEvent.setup();
    await user.click(within(chapters).getByRole("link", { name: /Érzékelés/ }));
    expect(await screen.findByRole("heading", { level: 2, name: /Érzékelés/ })).toBeTruthy();
    expect(screen.getByText("0 arany · 0 lépés")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lejátszás" }));
    expect(await screen.findByText("0 arany · 4 lépés", undefined, { timeout: 4000 })).toBeTruthy();
  });
});
