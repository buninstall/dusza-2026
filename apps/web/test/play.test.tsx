import type { Diagnostic, RunResult } from "@minescript/engine";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { usePlayUi } from "../src/play/play-ui-store.ts";
import { SPEED_MAX, usePlayback } from "../src/play/playback-store.ts";
import { callsTo, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { realEngine } from "./support/engine.ts";
import {
  crashTrace,
  LABYRINTH,
  mapDetail,
  respondPrograms,
  trace,
  walkTrace,
} from "./support/fixtures.ts";

const MAP_ID = 3;
const VERSION_ID = 31;
const PROGRAM = "set elol to isThere 2\nstep forward 2\nmine here\nprint 1\nturn by 1\n";

function seedProgram(
  source: string,
  linked: { id: number; title: string; savedSource: string } | null = null,
) {
  window.localStorage.setItem(`minescript.program.${MAP_ID}`, JSON.stringify({ source, linked }));
}

function linkedTitle(): string | undefined {
  const stored = window.localStorage.getItem(`minescript.program.${MAP_ID}`) ?? "{}";
  return (JSON.parse(stored) as { linked?: { title: string } | null }).linked?.title;
}

function editorText(): string {
  return [...document.querySelectorAll(".cm-line")].map((line) => line.textContent).join("\n");
}

function syntaxError(line: number): RunResult {
  const diagnostic: Diagnostic = {
    code: "SYN_DOUBLE_SPACE",
    severity: "error",
    span: { line, colStart: 5, colEnd: 6, from: 0, to: 1 },
    message: "Két token között pontosan egy szóköz állhat.",
    help: null,
    fixes: [],
  };
  return { ...walkTrace, events: [], outcome: { kind: "syntaxError", diagnostics: [diagnostic] } };
}

async function openPlay() {
  respond("GET", `/maps/${MAP_ID}`, mapDetail(MAP_ID, "Labirintus", LABYRINTH));
  const app = renderApp(`/play/${MAP_ID}`);
  await screen.findByRole("grid", { name: "Labirintus térképe" });
  await waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull());
  return app;
}

function runButton() {
  return screen.getByRole("button", { name: "Futtatás" });
}

beforeEach(() => {
  act(() => usePlayback.getState().setSpeed(SPEED_MAX));
  vi.restoreAllMocks();
});

describe("futtatás", () => {
  test("szintaktikai hibánál nem fut, a hibás sort jelzi a sávban és a szerkesztőben", async () => {
    seedProgram(PROGRAM);
    const run = vi.spyOn(realEngine, "run").mockReturnValue(syntaxError(2));
    const { user } = await openPlay();
    await user.click(runButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("A program szintaktikailag hibás");
    expect(alert.textContent).toContain("Hibás sor: 2.");
    expect(run).toHaveBeenCalledWith(PROGRAM, LABYRINTH);
    expect(document.querySelector(".cm-error-line")?.textContent).toBe("step forward 2");
    expect(usePlayback.getState().status).toBe("idle");
    await user.click(within(alert).getByRole("button", { name: "Mutasd a 2. sort" }));
    expect(callsTo("POST", "/runs")).toHaveLength(0);
  });

  test("sikeres futás lassítva lejátszódik, a végén beküldi, és a szerver számait mutatja", async () => {
    seedProgram(PROGRAM);
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    respond(
      "POST",
      "/runs",
      {
        run: { gold: 1, steps: 5 },
        outcome: { kind: "ok" },
        console: ["1"],
        standing: { rank: 2, players: 3, isPersonalBest: true },
      },
      201,
    );
    const { user } = await openPlay();
    await user.click(runButton());
    expect(document.querySelector(".cm-content")?.getAttribute("aria-readonly")).toBe("true");
    await waitFor(() => expect(callsTo("POST", "/runs")).toHaveLength(1), { timeout: 3000 });
    expect(callsTo("POST", "/runs")[0]?.body).toEqual({
      mapVersionId: VERSION_ID,
      source: PROGRAM,
    });
    expect(screen.queryByRole("log", { name: "Konzol" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Konzol/ }));
    expect(screen.getByRole("log", { name: "Konzol" }).textContent).toContain("1");
    expect(screen.getByRole("table", { name: "Változók" }).textContent).toContain("elol");
    expect(screen.getByText("Kész")).toBeTruthy();
    expect(document.querySelector(".cm-content")?.getAttribute("aria-readonly")).toBe("false");
  });

  test("a rögzített futás után a térkép adatai frissülnek, így a szerkesztő látja a futást", async () => {
    seedProgram(PROGRAM);
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    respond(
      "POST",
      "/runs",
      { run: { gold: 1, steps: 5 }, outcome: { kind: "ok" }, console: ["1"] },
      201,
    );
    const { user } = await openPlay();
    const loads = callsTo("GET", `/maps/${MAP_ID}`).length;
    await user.click(runButton());
    await waitFor(() => expect(callsTo("POST", "/runs")).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(callsTo("GET", `/maps/${MAP_ID}`).length).toBeGreaterThan(loads));
  });

  test("a leállított futás nem kerül beküldésre", async () => {
    seedProgram(PROGRAM);
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    act(() => usePlayback.getState().setSpeed(1));
    const { user } = await openPlay();
    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Leállítás" }));
    expect(
      await screen.findAllByText("A leállított futás nem kerül a ranglistára."),
    ).not.toHaveLength(0);
    expect(usePlayback.getState().status).toBe("stopped");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(callsTo("POST", "/runs")).toHaveLength(0);
  });

  test("futásidejű hibánál a kódot, a sort és a magyarázatot mutatja, és ezt is rögzíti", async () => {
    seedProgram("step forward 2\nstep forward 1\n");
    vi.spyOn(realEngine, "run").mockReturnValue(crashTrace);
    respond(
      "POST",
      "/runs",
      { run: { gold: 0, steps: 2 }, outcome: crashTrace.outcome, console: [] },
      201,
    );
    const { user } = await openPlay();
    await user.click(runButton());
    expect(
      await screen.findByText("E_BEDROCK_HIT · 2. sor", undefined, { timeout: 3000 }),
    ).toBeTruthy();
    expect(screen.getByText("Falba ütközés")).toBeTruthy();
    await waitFor(() => expect(callsTo("POST", "/runs")).toHaveLength(1));
    expect(screen.getByText("Hiba")).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector(".cm-runtime-line")?.textContent).toMatch(/^step forward 1/),
    );
    expect(document.querySelector(".cm-lens-line")?.getAttribute("data-lens")).toBe(
      "◂ Falba ütközés · E_BEDROCK_HIT",
    );
  });

  test("a térkép széléről lelépést nem falba ütközésnek nevezi", async () => {
    seedProgram("turn by 1\nstep forward 1\n");
    const edge = trace(
      [{ line: 1, robot: { pos: { row: 0, col: 0 }, dir: "north" } }, { line: 2 }],
      { kind: "runtimeError", code: "E_BEDROCK_HIT", line: 2, message: "Falba ütközés" },
    );
    vi.spyOn(realEngine, "run").mockReturnValue(edge);
    respond(
      "POST",
      "/runs",
      { run: { gold: 0, steps: 2 }, outcome: edge.outcome, console: [] },
      201,
    );
    const { user } = await openPlay();
    await user.click(runButton());
    expect(
      await screen.findByText("Lelépés a térképről", undefined, { timeout: 3000 }),
    ).toBeTruthy();
    expect(screen.queryByText("Falba ütközés")).toBeNull();
  });

  test("sikertelen beküldés újrapróbálható", async () => {
    seedProgram(PROGRAM);
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    let attempts = 0;
    onApi("POST", "/runs", () => {
      attempts += 1;
      return attempts === 1
        ? { status: 503, body: { error: { code: "DOWN", message: "A szerver nem érhető el." } } }
        : {
            status: 201,
            body: { run: { gold: 1, steps: 5 }, outcome: { kind: "ok" }, console: [] },
          };
    });
    const { user } = await openPlay();
    await user.click(runButton());
    await user.click(
      await screen.findByRole("button", { name: "Rögzítés újra" }, { timeout: 3000 }),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Rögzítés újra" })).toBeNull());
    expect(attempts).toBe(2);
  });
});

describe("lejátszásvezérlés", () => {
  test("szünet, léptetés, visszalépés, elejére és végére ugrás", async () => {
    seedProgram(PROGRAM);
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    respond(
      "POST",
      "/runs",
      { run: { gold: 1, steps: 5 }, outcome: { kind: "ok" }, console: [] },
      201,
    );
    act(() => usePlayback.getState().setSpeed(1));
    const { user } = await openPlay();
    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Szünet" }));
    await user.click(screen.getByRole("button", { name: "Egy sor előre" }));
    await user.click(screen.getByRole("button", { name: "Egy sor előre" }));
    expect(usePlayback.getState().index).toBe(2);
    expect(
      screen.getByRole("gridcell", { name: "1. sor, 3. oszlop: robot, kelet felé" }),
    ).toBeTruthy();
    expect(document.querySelector(".cm-exec-line")?.textContent).toBe("step forward 2");
    await user.click(screen.getByRole("button", { name: "Egy sor vissza" }));
    expect(usePlayback.getState().index).toBe(1);
    await user.click(screen.getByRole("button", { name: "Elejére" }));
    expect(usePlayback.getState().index).toBe(0);
    await user.click(screen.getByRole("button", { name: "Folytatás" }));
    expect(usePlayback.getState().status).toBe("playing");
    await user.click(screen.getByRole("button", { name: "Ugrás a végére" }));
    expect((await screen.findAllByText(/A program hiba nélkül lefutott/)).length).toBeGreaterThan(
      0,
    );
    await waitFor(() => expect(callsTo("POST", "/runs")).toHaveLength(1));
  });

  test("nyitott bányán nincs nézetváltó, a felderítetlen mezők rejtve maradnak", async () => {
    seedProgram(PROGRAM);
    act(() => usePlayUi.getState().setFogMode("full"));
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    act(() => usePlayback.getState().setSpeed(1));
    const { user } = await openPlay();
    expect(screen.queryByRole("radio", { name: "Teljes térkép" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Lámpafény" })).toBeNull();
    expect(screen.getByRole("gridcell", { name: "4. sor, 1. oszlop: fal" })).toBeTruthy();
    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Szünet" }));
    expect(screen.getByRole("gridcell", { name: "4. sor, 1. oszlop: felderítetlen" })).toBeTruthy();
  });
});

describe("program kezelése", () => {
  test("importálás: a hibás és a NUL-t tartalmazó fájl nem töltődik be, a helyes igen", async () => {
    const { user } = await openPlay();
    const before = editorText();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const choose = (file: File) => {
      const list = { 0: file, length: 1, item: () => file };
      Object.defineProperty(input, "files", { value: list, configurable: true });
      fireEvent.change(input);
    };
    choose(new File(["step  forward 1\r\n"], "hibas.ms"));
    const rejected = await screen.findByRole("alertdialog", { name: "A program nem tölthető be" });
    expect(rejected.textContent).toContain("Fájl: hibas.ms");
    expect(rejected.textContent).toContain("1. sor");
    expect(rejected.textContent).toContain("Dupla szóköz");
    expect(editorText()).toBe(before);
    await user.click(within(rejected).getByRole("button", { name: "Bezárás" }));
    choose(new File(["print 1\u0000"], "bin.ms"));
    const binary = await screen.findByRole("alertdialog", { name: "A program nem tölthető be" });
    expect(binary.textContent).toMatch(/NUL karaktert tartalmaz/);
    expect(editorText()).toBe(before);
    await user.click(within(binary).getByRole("button", { name: "Bezárás" }));
    choose(new File(["print 1\r\n"], "egy.ms"));
    expect(await screen.findByText("Az egy.ms program betöltve.")).toBeTruthy();
    await waitFor(() => expect(editorText()).toBe("print 1\n"));
  });

  test("importálás: a szintaktikailag hibás fájl kérésre megnyílik javításra, a hibás sorok jelölve", async () => {
    const { user } = await openPlay();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const choose = (file: File) => {
      const list = { 0: file, length: 1, item: () => file };
      Object.defineProperty(input, "files", { value: list, configurable: true });
      fireEvent.change(input);
    };
    choose(new File(["print 1\u0000"], "bin.ms"));
    const binary = await screen.findByRole("alertdialog", { name: "A program nem tölthető be" });
    expect(within(binary).queryByRole("button", { name: "Megnyitás javításra" })).toBeNull();
    await user.click(within(binary).getByRole("button", { name: "Bezárás" }));
    choose(new File(["print 1\r\nstep  forward 1\r\nfoo\r\n"], "javit.ms"));
    const rejected = await screen.findByRole("alertdialog", { name: "A program nem tölthető be" });
    expect(rejected.textContent).toContain("Megnyitás javításra");
    await user.click(within(rejected).getByRole("button", { name: "Megnyitás javításra" }));
    expect(
      await screen.findByText(
        "A javit.ms program betöltve javításra: 2 hibás sor. Futtatás előtt javítsd ki.",
      ),
    ).toBeTruthy();
    await waitFor(() => expect(editorText()).toBe("print 1\nstep  forward 1\nfoo\n"));
    expect(screen.queryByRole("alertdialog", { name: "A program nem tölthető be" })).toBeNull();
    expect(await screen.findByRole("region", { name: /^Hibalista/ })).toBeTruthy();
  });

  test("exportálás és formázás", async () => {
    seedProgram("print  1\n");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:program");
    URL.revokeObjectURL = vi.fn();
    const format = vi
      .spyOn(realEngine, "format")
      .mockReturnValueOnce({ text: "print 1\n", changed: true, diagnostics: [] })
      .mockReturnValueOnce({ text: "x", changed: false, diagnostics: syntaxErrorDiagnostics() });
    const { user } = await openPlay();
    await user.click(screen.getByRole("button", { name: /^Fájl/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Exportálás fájlba" }));
    expect(click).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Formázás" }));
    expect(await screen.findByText("A program formázva.")).toBeTruthy();
    await waitFor(() => expect(editorText()).toBe("print 1\n"));
    await user.click(screen.getByRole("button", { name: "Formázás" }));
    expect(await screen.findByText(/csak szintaktikailag helyes programon/)).toBeTruthy();
    expect(format).toHaveBeenCalledTimes(2);
  });

  test("mentés újként, majd gyorsmentés a megnyitott programba", async () => {
    seedProgram("print 1\n");
    respondPrograms([]);
    respond(
      "POST",
      "/programs",
      { program: { id: 5, title: "Első", source: "print 1\n", ownerId: 2, updatedAt: 1 } },
      201,
    );
    respond("PUT", "/programs/5", {
      program: { id: 5, title: "Első", source: "print 1\n", ownerId: 2, updatedAt: 2 },
    });
    const { user } = await openPlay();
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    const dialog = await screen.findByRole("dialog", { name: "Program mentése" });
    const title = within(dialog).getByRole("textbox", { name: /Program neve/ });
    await user.clear(title);
    await user.type(title, "Első");
    await user.click(within(dialog).getByRole("button", { name: "Mentés újként" }));
    await waitFor(() => expect(linkedTitle()).toBe("Első"));
    expect(callsTo("POST", "/programs")[0]?.body).toEqual({ title: "Első", source: "print 1\n" });
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    await waitFor(() => expect(callsTo("PUT", "/programs/5")).toHaveLength(1));
  });

  test("ha a csatolt program már nincs meg a szerveren, a mentés újként menti", async () => {
    seedProgram("print 2\n", { id: 77, title: "Régi", savedSource: "print 1\n" });
    respondPrograms([]);
    respond(
      "PUT",
      "/programs/77",
      { error: { code: "NOT_FOUND", message: "A keresett erőforrás nem található." } },
      404,
    );
    respond(
      "POST",
      "/programs",
      { program: { id: 9, title: "Régi", source: "print 2\n", ownerId: 2, updatedAt: 3 } },
      201,
    );
    const { user } = await openPlay();
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    await waitFor(() => expect(callsTo("POST", "/programs")).toHaveLength(1));
    expect(callsTo("POST", "/programs")[0]?.body).toEqual({ title: "Régi", source: "print 2\n" });
    expect(screen.queryByText("A keresett erőforrás nem található.")).toBeNull();
  });

  test("megnyitás nem mentett módosítás esetén megerősítést kér, a törlés lecsatol", async () => {
    seedProgram("print 2\n", { id: 5, title: "Első", savedSource: "print 1\n" });
    respondPrograms([
      { id: 5, title: "Első", updatedAt: 1 },
      { id: 6, title: "Második", updatedAt: 2 },
    ]);
    respond("GET", "/programs/6", {
      program: { id: 6, title: "Második", source: "turn by 1\n", ownerId: 2, updatedAt: 2 },
    });
    respond("DELETE", "/programs/5", { ok: true });
    const { user } = await openPlay();
    expect(linkedTitle()).toBe("Első");
    await user.click(screen.getByRole("button", { name: "Programtár" }));
    const dialog = await screen.findByRole("dialog", { name: "Mentett programok" });
    await user.click(await within(dialog).findByRole("button", { name: "Megnyitás: Második" }));
    expect(await within(dialog).findByText("Felülírod a szerkesztő tartalmát?")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Megnyitás" }));
    await waitFor(() => expect(linkedTitle()).toBe("Második"));
    await waitFor(() => expect(editorText()).toBe("turn by 1\n"));

    await user.click(screen.getByRole("button", { name: "Programtár" }));
    const again = await screen.findByRole("dialog", { name: "Mentett programok" });
    await user.click(await within(again).findByRole("button", { name: "Törlés: Első" }));
    const confirm = await screen.findByRole("alertdialog", {
      name: "Biztosan törlöd a programot?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Program törlése" }));
    await waitFor(() => expect(callsTo("DELETE", "/programs/5")).toHaveLength(1));
  });

  test("a hibalista eleme a szerkesztőbe viszi a fókuszt", async () => {
    seedProgram("print 1\n");
    const diagnostics = syntaxErrorDiagnostics();
    vi.spyOn(realEngine, "analyze").mockReturnValue({
      diagnostics,
      tokens: [],
      folds: [],
      symbols: [],
    });
    const { user } = await openPlay();
    const toggle = await screen.findByRole("button", { name: "Hibalista" });
    await waitFor(() => expect(toggle.hasAttribute("disabled")).toBe(false));
    await user.click(toggle);
    const item = await screen.findByRole("button", { name: /Ugrás az 1\. sorra, hiba/ });
    await user.click(item);
    expect(document.activeElement?.closest(".cm-editor")).not.toBeNull();
  });
});

function syntaxErrorDiagnostics(): Diagnostic[] {
  const result = syntaxError(1).outcome;
  return result.kind === "syntaxError" ? result.diagnostics : [];
}
