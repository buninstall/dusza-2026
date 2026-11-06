import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { recipeText } from "../src/recipes/catalog.ts";
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
    expect(screen.getAllByText("Ez a pálya nincs az adatbázisban.").length).toBe(7);
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
    const chapters = await screen.findByRole("tablist", { name: "Tartalom" });
    const first = within(chapters).getByRole("tab", { name: /A játék röviden/ });
    expect(first.getAttribute("aria-selected")).toBe("true");
    const entry = screen.getByRole("link", { name: "Receptek: kész programok minden pályához" });
    expect(entry.getAttribute("href")).toBe("/manual/receptek");
    expect(screen.getByRole("heading", { level: 1, name: "Kézikönyv" })).toBeTruthy();
  });

  test("a fejezet próbapadja lejátssza a példát a mini pályán", async () => {
    renderApp("/manual");
    const chapters = await screen.findByRole("tablist", { name: "Tartalom" });
    const user = userEvent.setup();
    await user.click(within(chapters).getByRole("tab", { name: /Érzékelés/ }));
    expect(screen.getByRole("heading", { level: 2, name: /Érzékelés/ })).toBeTruthy();
    expect(screen.getByText("0 arany · 0 lépés")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lejátszás" }));
    expect(await screen.findByText("0 arany · 4 lépés", undefined, { timeout: 4000 })).toBeTruthy();
  });
});
