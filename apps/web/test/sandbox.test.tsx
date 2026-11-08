import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiError, callsTo, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import {
  CORRIDOR,
  LABYRINTH,
  mapDetail,
  mapPage,
  mapSummary,
  respondMaps,
  respondPrograms,
} from "./support/fixtures.ts";

const MANY = Array.from({ length: 20 }, (_, index) =>
  mapSummary(index + 1, `Pálya ${String(index + 1).padStart(2, "0")}`, CORRIDOR),
);

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

function titlesIn(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent ?? "");
}

describe("lapozott homokozó", () => {
  test("fülváltáskor a régi lista halványítva marad, amíg az új meg nem jön", async () => {
    respondMaps(MANY);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    onApi("GET", "/maps", async (request) => {
      if (request.search.get("scope") === "favorites") {
        await gate;
      }
      return {
        body: mapPage(request.search.get("scope") === "favorites" ? [] : MANY, request.search),
      };
    });
    const { user } = renderApp("/maps?sort=order");
    await screen.findByRole("list", { name: "Pályák listája" });
    await user.click(screen.getByRole("tab", { name: "Kedvencek" }));
    const held = await screen.findByRole("list", { name: "Pályák listája" });
    expect(held.getAttribute("aria-busy")).toBe("true");
    expect(titlesIn(held)[0]).toBe("Pálya 01");
    release();
    await waitFor(() => expect(screen.queryByRole("list", { name: "Pályák listája" })).toBeNull());
  });

  test("nyolcasával lapoz, a következő oldalt előre betölti, felgörget és a listára fókuszál", async () => {
    respondMaps(MANY);
    const { user, router } = renderApp("/maps?sort=order");
    const list = await screen.findByRole("list", { name: "Pályák listája" });
    expect(titlesIn(list)).toHaveLength(8);
    expect(screen.getByText("1–8 / 20 pálya · Oldal: 1 / 3")).toBeTruthy();
    await waitFor(() =>
      expect(callsTo("GET", "/maps").some((call) => call.search.get("page") === "2")).toBe(true),
    );
    const pager = screen.getByRole("navigation", { name: "Lapozás" });
    await user.click(within(pager).getByRole("button", { name: "Következő" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ page: 2 }));
    const next = await screen.findByRole("list", { name: "Pályák listája" });
    await waitFor(() => expect(titlesIn(next)[0]).toBe("Pálya 09"));
    expect(scrollIntoView).toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(next));
    await user.click(screen.getByRole("button", { name: "3. oldal" }));
    await waitFor(() =>
      expect(titlesIn(screen.getByRole("list", { name: "Pályák listája" }))).toEqual([
        "Pálya 17",
        "Pálya 18",
        "Pálya 19",
        "Pálya 20",
      ]),
    );
  });

  test("a keresés késleltetve szűr, az első oldalra ugrik, és üres találatnál törölhető", async () => {
    respondMaps([...MANY, mapSummary(99, "Labirintus", LABYRINTH)]);
    const { user, router } = renderApp("/maps?page=2");
    await screen.findByRole("list", { name: "Pályák listája" });
    const search = screen.getByRole("searchbox", { name: "Keresés a pályák között" });
    await user.type(search, "labir");
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ q: "labir", page: 1 }),
    );
    await waitFor(() =>
      expect(titlesIn(screen.getByRole("list", { name: "Pályák listája" }))).toEqual([
        "Labirintus",
      ]),
    );
    expect(document.activeElement).toBe(search);
    await user.clear(search);
    await user.type(search, "nincs ilyen");
    expect(await screen.findByText(/Nincs pálya erre: „nincs ilyen”/)).toBeTruthy();
    await user.click(
      within(screen.getByText(/Nincs pálya erre/).closest(".empty") as HTMLElement).getByRole(
        "button",
        { name: "Keresés törlése" },
      ),
    );
    await waitFor(() => expect(router.state.location.search).toMatchObject({ q: "" }));
  });

  test("a kedvenc gomb azonnal vált, hibánál visszaáll; a Kedvencek fül csak a kedvenceket mutatja", async () => {
    respondMaps([
      { ...mapSummary(1, "Folyosó", CORRIDOR), isFavorite: true, favoriteCount: 4 },
      mapSummary(2, "Labirintus", LABYRINTH),
    ]);
    onApi("PUT", "/maps/:id/favorite", () => apiError(500, "INTERNAL", "Belső hiba történt."));
    const { user } = renderApp("/maps");
    const toggle = await screen.findByRole("button", { name: "Kedvenc: Labirintus, 0 kedvenc" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    await user.click(toggle);
    await waitFor(() => expect(callsTo("PUT", "/maps/2/favorite")).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Kedvenc: Labirintus, 0 kedvenc" })
          .getAttribute("aria-pressed"),
      ).toBe("false"),
    );
    const kept = screen.getByRole("button", { name: "Kedvenc: Folyosó, 4 kedvenc" });
    expect(kept.getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Kedvencek" }));
    await waitFor(() =>
      expect(titlesIn(screen.getByRole("list", { name: "Pályák listája" }))).toEqual(["Folyosó"]),
    );
  });

  test("a sikeres kedvencnek jelölés a szerver számlálóját mutatja", async () => {
    const map = mapSummary(2, "Labirintus", LABYRINTH);
    respondMaps([map]);
    onApi("PUT", "/maps/:id/favorite", () => {
      respondMaps([{ ...map, isFavorite: true, favoriteCount: 7 }]);
      return { body: { isFavorite: true, favoriteCount: 7 } };
    });
    const { user } = renderApp("/maps");
    await user.click(await screen.findByRole("button", { name: "Kedvenc: Labirintus, 0 kedvenc" }));
    const pressed = await screen.findByRole("button", { name: "Kedvenc: Labirintus, 7 kedvenc" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("lapozott programtár", () => {
  test("nyolcasával lapoz, keres, és mutatja a kvótát", async () => {
    respond("GET", "/maps/3", mapDetail(3, "Labirintus", LABYRINTH));
    respondPrograms(
      Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        title: `Megoldás ${index + 1}`,
        updatedAt: index,
        lines: index + 1,
      })),
    );
    const { user } = renderApp("/play/3");
    await screen.findByRole("grid", { name: "Labirintus térképe" });
    await user.click(await screen.findByRole("button", { name: "Programtár" }));
    const dialog = await screen.findByRole("dialog", { name: "Mentett programok" });
    const list = await within(dialog).findByRole("list", { name: "Mentett programok" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(within(dialog).getByText(/1–8 \/ 12 program · 12 \/ 500 program a tárban/)).toBeTruthy();
    expect(within(dialog).getByText(/3 sor/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Következő" }));
    await waitFor(() =>
      expect(
        within(within(dialog).getByRole("list", { name: "Mentett programok" })).getAllByRole(
          "listitem",
        ),
      ).toHaveLength(4),
    );
    await user.type(
      within(dialog).getByRole("searchbox", { name: "Keresés a programok között" }),
      "megoldás 1",
    );
    await waitFor(() =>
      expect(
        callsTo("GET", "/programs").some((call) => call.search.get("q") === "megoldás 1"),
      ).toBe(true),
    );
    const last = callsTo("GET", "/programs").at(-1);
    expect(last?.search.get("page")).toBe("1");
  });
});
