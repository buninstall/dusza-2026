import type { Diagnostic, RunResult } from "@minescript/engine";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SPEED_MAX, usePlayback } from "../src/play/playback-store.ts";
import { callsTo, onApi, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { realEngine } from "./support/engine.ts";
import { crashTrace, LABYRINTH, mapDetail, walkTrace } from "./support/fixtures.ts";

const MAP_ID = 3;
const VERSION_ID = 31;
const PROGRAM = "set elol to isThere 2\nstep forward 2\nmine here\nprint 1\nturn by 1\n";

function seedProgram(
  source: string,
  linked: { id: number; title: string; savedSource: string } | null = null,
) {
  window.localStorage.setItem(`minescript.program.${MAP_ID}`, JSON.stringify({ source, linked }));
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
    expect(alert.textContent).toContain("A program szintaktikailag hibás, ezért nem futtatható.");
    expect(alert.textContent).toContain("Hibás sor: 2.");
    expect(run).toHaveBeenCalledWith(PROGRAM, LABYRINTH);
    expect(document.querySelector(".cm-error-line")?.textContent).toBe("step forward 2");
    expect(usePlayback.getState().status).toBe("idle");
    await user.click(within(alert).getByRole("button", { name: "Mutasd a(z) 2. sort" }));
    expect(callsTo("POST", "/runs")).toHaveLength(0);
  });

  test("sikeres futás lassítva lejátszódik, a végén beküldi, és a szerver számait mutatja", async () => {
    seedProgram(PROGRAM);
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    respond(
      "POST",
      "/runs",
      { run: { gold: 1, steps: 5 }, outcome: { kind: "ok" }, console: ["1"] },
      201,
    );
    const { user } = await openPlay();
    await user.click(runButton());
    expect(screen.getByText("Futás közben zárolva")).toBeTruthy();
    expect(
      (await screen.findAllByText(/A program hiba nélkül lefutott/, undefined, { timeout: 3000 }))
        .length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText("A szerver rögzítette: 1 arany, 5 lépés.")).toBeTruthy();
    expect(callsTo("POST", "/runs")[0]?.body).toEqual({
      mapVersionId: VERSION_ID,
      source: PROGRAM,
    });
    expect(screen.getByRole("log", { name: "Konzol" }).textContent).toContain("1");
    expect(screen.getByRole("table", { name: "Változók" }).textContent).toContain("elol");
    expect(screen.getByText("Kész")).toBeTruthy();
    expect(screen.queryByText("Futás közben zárolva")).toBeNull();
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
    expect(await screen.findByText("A szerver rögzítette: 1 arany, 5 lépés.")).toBeTruthy();
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
      await screen.findAllByText("E_BEDROCK_HIT · 2. sor", undefined, { timeout: 3000 }),
    ).not.toHaveLength(0);
    expect(screen.getByText("Falba ütközés.")).toBeTruthy();
    expect(await screen.findByText("A szerver rögzítette: 0 arany, 2 lépés.")).toBeTruthy();
    expect(screen.getByText("Hiba")).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector(".cm-runtime-line")?.textContent).toMatch(/^step forward 1/),
    );
    expect(document.querySelector(".cm-lens")?.textContent).toBe("◂ E_BEDROCK_HIT · Falba ütközés");
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
    expect(await screen.findByText("A szerver rögzítette: 1 arany, 5 lépés.")).toBeTruthy();
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

  test("a nézetváltó a felderítetlen mezőket jelöli vagy elrejti", async () => {
    seedProgram(PROGRAM);
    vi.spyOn(realEngine, "run").mockReturnValue(walkTrace);
    act(() => usePlayback.getState().setSpeed(1));
    const { user } = await openPlay();
    expect(screen.getByRole("gridcell", { name: "4. sor, 1. oszlop: fal" })).toBeTruthy();
    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Szünet" }));
    expect(screen.getByRole("gridcell", { name: "4. sor, 1. oszlop: felderítetlen" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Teljes térkép" }));
    expect(
      screen.getByRole("gridcell", { name: "4. sor, 1. oszlop: fal, még nem felfedezett" }),
    ).toBeTruthy();
  });
});

describe("program kezelése", () => {
  test("importálás: a hibás program betöltődik, a NUL-t tartalmazó fájl nem", async () => {
    const { user } = await openPlay();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const choose = (file: File) => {
      const list = { 0: file, length: 1, item: () => file };
      Object.defineProperty(input, "files", { value: list, configurable: true });
      fireEvent.change(input);
    };
    choose(new File(["step  forward 1\r\n"], "hibas.ms"));
    expect(await screen.findByText("A(z) hibas.ms program betöltve.")).toBeTruthy();
    await waitFor(() => expect(editorText()).toBe("step  forward 1\n"));
    choose(new File(["print 1\u0000"], "bin.ms"));
    expect(await screen.findByText(/NUL karaktert tartalmaz/)).toBeTruthy();
    expect(editorText()).toBe("step  forward 1\n");
    expect(user).toBeTruthy();
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
    respond("GET", "/programs", { programs: [] });
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
    expect(await screen.findByText("Megnyitva: Első")).toBeTruthy();
    expect(callsTo("POST", "/programs")[0]?.body).toEqual({ title: "Első", source: "print 1\n" });
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    await waitFor(() => expect(callsTo("PUT", "/programs/5")).toHaveLength(1));
  });

  test("megnyitás nem mentett módosítás esetén megerősítést kér, a törlés lecsatol", async () => {
    seedProgram("print 2\n", { id: 5, title: "Első", savedSource: "print 1\n" });
    respond("GET", "/programs", {
      programs: [
        { id: 5, title: "Első", updatedAt: 1 },
        { id: 6, title: "Második", updatedAt: 2 },
      ],
    });
    respond("GET", "/programs/6", {
      program: { id: 6, title: "Második", source: "turn by 1\n", ownerId: 2, updatedAt: 2 },
    });
    respond("DELETE", "/programs/5", { ok: true });
    const { user } = await openPlay();
    expect(screen.getByText("módosítva")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Programtár" }));
    const dialog = await screen.findByRole("dialog", { name: "Mentett programok" });
    await user.click(await within(dialog).findByRole("button", { name: "Megnyitás: Második" }));
    expect(await within(dialog).findByText("Felülírod a szerkesztő tartalmát?")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Megnyitás" }));
    expect(await screen.findByText("Megnyitva: Második")).toBeTruthy();
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
    const item = await screen.findByRole("button", { name: /Ugrás a\(z\) 1\. sorra, hiba/ });
    await user.click(item);
    expect(document.activeElement?.closest(".cm-editor")).not.toBeNull();
  });
});

function syntaxErrorDiagnostics(): Diagnostic[] {
  const result = syntaxError(1).outcome;
  return result.kind === "syntaxError" ? result.diagnostics : [];
}
