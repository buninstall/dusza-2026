import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SPEED_MAX, usePlayback } from "../src/play/playback-store.ts";
import { useTour } from "../src/tour/tour-state.ts";
import { apiError, callsTo, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { realEngine } from "./support/engine.ts";
import {
  CORRIDOR,
  LABYRINTH,
  mapDetail,
  mapSummary,
  respondMaps,
  walkTrace,
} from "./support/fixtures.ts";

const MAP_ID = 3;

function editorText(): string {
  return [...document.querySelectorAll(".cm-line")].map((line) => line.textContent).join("\n");
}

async function openPlay(options: Parameters<typeof mapDetail>[3] = {}) {
  respond(
    "GET",
    `/maps/${MAP_ID}`,
    mapDetail(MAP_ID, "Labirintus", LABYRINTH, { next: { id: 4, title: "Folyosó" }, ...options }),
  );
  respondMaps([mapSummary(MAP_ID, "Labirintus", LABYRINTH), mapSummary(4, "Folyosó", CORRIDOR)]);
  const app = renderApp(`/play/${MAP_ID}`);
  await screen.findByRole("grid", { name: "Labirintus térképe" });
  await waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull());
  return app;
}

beforeEach(() => {
  act(() => usePlayback.getState().setSpeed(SPEED_MAX));
  vi.restoreAllMocks();
});

describe("eredmény a játék oldalon", () => {
  test("a futás végén az eredménysáv az új rögöt és a következő pályát mutatja", async () => {
    window.localStorage.setItem(
      `minescript.program.${MAP_ID}`,
      JSON.stringify({ source: "step forward 2\nmine here\n", linked: null }),
    );
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    respond(
      "POST",
      "/runs",
      {
        run: { gold: 1, steps: 5 },
        outcome: { kind: "ok" },
        console: [],
        standing: {
          rank: 1,
          players: 1,
          isPersonalBest: true,
          stars: { run: 2, best: 2, previous: 1, parSteps: 3 },
        },
      },
      201,
    );
    const { user } = await openPlay({ parSteps: 3 });
    expect(screen.getByText("Cél: 3 lépés")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Futtatás" }));
    const medal = await screen.findByRole("region", { name: "Eredmény" }, { timeout: 4000 });
    expect(within(medal).getByRole("img", { name: "2 / 3 rög" })).toBeTruthy();
    expect(within(medal).getByText("Új rög!")).toBeTruthy();
    expect(within(medal).getByText("A harmadik röghöz legfeljebb 3 lépés kell.")).toBeTruthy();
    expect(
      within(medal).getByRole("link", { name: "Következő pálya: Folyosó" }).getAttribute("href"),
    ).toBe("/play/4");
    await user.click(within(medal).getByRole("button", { name: "Bezárás" }));
    expect(screen.queryByRole("region", { name: "Eredmény" })).toBeNull();
  });
});

describe("lámpafényes pálya", () => {
  test("futás előtt sötét a bánya, a teljes térkép zárolva, az akku látszik", async () => {
    await openPlay({ lampMode: "lamp", canEdit: false });
    expect(screen.getByRole("gridcell", { name: "3. sor, 4. oszlop: felderítetlen" })).toBeTruthy();
    expect(
      screen.getByRole("gridcell", { name: "2. sor, 1. oszlop: üres kamra, még nem felfedezett" }),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Teljes térkép" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Akku: 1 / 4, a lámpa 1 mezőnyire világít.")).toBeTruthy();
  });

  test("három rög után a teljes térkép választható", async () => {
    await openPlay({ lampMode: "lamp", stars: 3, canEdit: false });
    expect(screen.getByRole("radio", { name: "Teljes térkép" })).toHaveProperty("disabled", false);
  });

  test("a vázlat a következő futás előtt is látszik", async () => {
    window.localStorage.setItem(
      `minescript.lamp-sketch.2.${MAP_ID * 10 + 1}`,
      JSON.stringify({ discovered: ["2:3"], lit: ["2:4"] }),
    );
    await openPlay({ lampMode: "dark", canEdit: false });
    expect(screen.getByRole("gridcell", { name: "3. sor, 4. oszlop: arany" })).toBeTruthy();
    expect(
      screen.getByRole("gridcell", { name: "3. sor, 5. oszlop: üres kamra, még nem felfedezett" }),
    ).toBeTruthy();
    expect(screen.getByText("Akku: 0 / 4, a lámpa 0 mezőnyire világít.")).toBeTruthy();
  });

  test("falnak ütközés után a vázlat törlődik", async () => {
    const key = `minescript.lamp-sketch.2.${MAP_ID * 10 + 1}`;
    window.localStorage.setItem(key, JSON.stringify({ discovered: ["2:3"], lit: [] }));
    window.localStorage.setItem(
      `minescript.program.${MAP_ID}`,
      JSON.stringify({ source: "turn by 1\nstep forward 1\n", linked: null }),
    );
    respond("POST", "/runs", apiError(500, "INTERNAL", "nem kell"));
    const { user } = await openPlay({ lampMode: "lamp", canEdit: false });
    await user.click(screen.getAllByRole("button", { name: /Futtatás/ })[0] as HTMLElement);
    expect(await screen.findByText("Összetört a lámpa")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(key) ?? "{}")).toEqual({
      discovered: [],
      lit: [],
    });
  });
});

describe("bevezető a játék oldalon", () => {
  test("végigvezet: beírja a parancsot, és lépésről lépésre halad", async () => {
    act(() => useTour.getState().start(MAP_ID));
    const { user } = await openPlay();
    expect(await screen.findByRole("heading", { name: "Ez a bánya" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Tovább" }));
    await user.click(await screen.findByRole("button", { name: "Beírom: step forward 3" }));
    await waitFor(() => expect(editorText()).toBe("step forward 3"));
    expect(await screen.findByRole("heading", { name: "Indítsd el!" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Bevezető bezárása" }));
    expect(screen.queryByRole("heading", { name: "Indítsd el!" })).toBeNull();
    expect(useTour.getState().data.status).toBe("done");
  });
});

describe("térképszerkesztő extrák", () => {
  async function openNew() {
    const app = renderApp("/maps/new");
    await screen.findByRole("grid", { name: "Térképrács" });
    return app;
  }

  test("a generálás betölti a pályát és kitölti a célértéket", async () => {
    respond("POST", "/maps/generate", { content: "1 3\n>@.\n", parSteps: 2, seed: 5 });
    const { user } = await openNew();
    await user.click(screen.getByRole("button", { name: "Továbbiak" }));
    await user.click(await screen.findByRole("menuitem", { name: "Generálás…" }));
    const dialog = await screen.findByRole("dialog", { name: "Pálya generálása" });
    await user.click(within(dialog).getByRole("radio", { name: "Nehéz" }));
    await user.click(within(dialog).getByRole("button", { name: "Generálás" }));
    await waitFor(() =>
      expect(callsTo("POST", "/maps/generate")[0]?.body).toEqual({
        rows: 7,
        cols: 10,
        difficulty: "hard",
      }),
    );
    expect(await screen.findByRole("gridcell", { name: "1. sor, 2. oszlop: arany" })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "Célérték (lépés)" }) as HTMLInputElement).value,
    ).toBe("2");
    expect(screen.queryByText("A térkép azóta változott, számold újra.")).toBeNull();
    screen.getByRole("gridcell", { name: "1. sor, 3. oszlop: üres kamra" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("A térkép azóta változott, számold újra.")).toBeTruthy();
  });

  test("a bal sáv Generálás gombja és billentyűgombja menü nélkül nyílik", async () => {
    const { user } = await openNew();
    await user.click(screen.getByRole("button", { name: "Billentyűk" }));
    expect(await screen.findByText("festés a kijelölt mezőre")).toBeTruthy();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Generálás…" }));
    expect(await screen.findByRole("dialog", { name: "Pálya generálása" })).toBeTruthy();
  });

  test("a gépi megoldás a szerver számát írja a célértékbe, hibánál üzen", async () => {
    respond("POST", "/maps/par", { parSteps: null });
    const { user } = await openNew();
    await user.click(screen.getByRole("button", { name: "Gépi megoldás" }));
    expect(await screen.findByText(/nincs kibányászható arany/)).toBeTruthy();
    onApi("POST", "/maps/par", () => apiError(500, "INTERNAL", "Váratlan szerverhiba."));
    await user.click(screen.getByRole("button", { name: "Gépi megoldás" }));
    expect(await screen.findByText("Váratlan szerverhiba.")).toBeTruthy();
  });

  test("a Kipróbálás mentés nélkül játszik, és visszatér a szerkesztőhöz", async () => {
    const { user } = await openNew();
    await user.click(screen.getByRole("button", { name: "Továbbiak" }));
    await user.click(await screen.findByRole("menuitem", { name: "Falkeret" }));
    await user.click(screen.getByRole("button", { name: "Kipróbálás" }));
    expect(await screen.findByText("Mentetlen térkép")).toBeTruthy();
    expect(
      screen.getAllByText(/Próbafutás: az eredmény nem kerül a ranglistára/).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Vissza a szerkesztőbe" }));
    expect(await screen.findByRole("gridcell", { name: "1. sor, 3. oszlop: fal" })).toBeTruthy();
  });
});
