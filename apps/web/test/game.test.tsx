import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  breakpointField,
  breakpointLines,
  breakpoints,
  toggleBreakpoint,
} from "../src/editor/breakpoints.ts";
import { NuggetRow } from "../src/game/NuggetRow.tsx";
import { clearDraft, emptyDraft, frameDraft, paint } from "../src/map-editor/editor-state.ts";
import { usePlayback } from "../src/play/playback-store.ts";
import { isSoundOn, playCue, SOUND_KEY, setSoundOn } from "../src/sound/sfx.ts";
import { activeStep, TOUR_KEY, useTour } from "../src/tour/tour-state.ts";
import { callsTo, respond } from "./support/api.ts";
import { renderApp } from "./support/app.tsx";
import { CORRIDOR, corridorStart, LABYRINTH, mapSummary, walkTrace } from "./support/fixtures.ts";

describe("rögök", () => {
  test("a rögsor olvasható címkét kap", () => {
    render(<NuggetRow earned={2} />);
    expect(screen.getByRole("img", { name: "2 / 3 rög" })).toBeTruthy();
  });
});

describe("gyors térképműveletek", () => {
  test("a falkeret a széleket falra cseréli, a robotnak kijáratot hagy", () => {
    const framed = frameDraft(emptyDraft(3, 4));
    expect(framed.cells.map((row) => row.map((cell) => cell[0]).join(""))).toEqual([
      "eeww",
      "eeew",
      "wwww",
    ]);
    expect(framed.robot).toEqual({ row: 0, col: 0 });
  });

  test("a Mind üres minden mezőt kiürít", () => {
    const gold = paint(emptyDraft(2, 2), { row: 1, col: 1 }, "gold", "east");
    expect(clearDraft(gold).cells.flat()).toEqual(["empty", "empty", "empty", "empty"]);
  });
});

describe("töréspontok", () => {
  test("a töréspont a sorhoz tapad, szerkesztéskor is", () => {
    const changes: (readonly number[])[] = [];
    const view = new EditorView({
      state: EditorState.create({
        doc: "print 1\nprint 2\nprint 3",
        extensions: [
          breakpoints({ onChange: (lines) => changes.push(lines), onKeyToggle: () => undefined }),
        ],
      }),
    });
    toggleBreakpoint(view, view.state.doc.line(2).from + 3);
    expect(breakpointLines(view.state)).toEqual([2]);
    view.dispatch({ changes: { from: 0, insert: "print 0\n" } });
    expect(breakpointLines(view.state)).toEqual([3]);
    toggleBreakpoint(view, view.state.doc.line(3).from);
    expect(breakpointLines(view.state)).toEqual([]);
    expect(changes).toEqual([[2], [3], []]);
    expect(view.state.field(breakpointField).size).toBe(0);
    view.destroy();
  });

  test("a lejátszás megáll a töréspont sorának végrehajtása után", () => {
    usePlayback.getState().setBreakpoints([2]);
    usePlayback.getState().load(walkTrace, corridorStart, "");
    usePlayback.getState().tick();
    expect(usePlayback.getState().status).toBe("playing");
    usePlayback.getState().tick();
    expect(usePlayback.getState()).toMatchObject({
      status: "paused",
      index: 2,
      breakHit: { line: 2, index: 2 },
    });
    usePlayback.getState().play();
    usePlayback.getState().tick();
    expect(usePlayback.getState().status).toBe("playing");
  });
});

describe("hang", () => {
  test("a némítás megmarad, és AudioContext nélkül sem hibázik", () => {
    expect(isSoundOn()).toBe(true);
    setSoundOn(false);
    expect(window.localStorage.getItem(SOUND_KEY)).toBe("off");
    expect(isSoundOn()).toBe(false);
    expect(() => playCue("finish")).not.toThrow();
    setSoundOn(true);
    expect(() => playCue("step")).not.toThrow();
  });
});

describe("bevezető", () => {
  test("a válasz és a haladás a böngészőben marad", () => {
    expect(useTour.getState().data.status).toBe("declined");
    useTour.getState().start(7);
    expect(activeStep(useTour.getState().data, 7)).toBe("board");
    expect(activeStep(useTour.getState().data, 8)).toBeNull();
    useTour.getState().advance();
    expect(JSON.parse(window.localStorage.getItem(TOUR_KEY) ?? "{}")).toEqual({
      status: "active",
      mapId: 7,
      step: 1,
    });
    useTour.getState().finish();
    expect(JSON.parse(window.localStorage.getItem(TOUR_KEY) ?? "{}")).toEqual({
      status: "done",
    });
  });

  test("a pályák oldala felugró ablakban megkérdezi, a Nem választ megjegyzi", async () => {
    useTour.setState({ data: { status: "unasked" } });
    respond("GET", "/maps", { maps: [mapSummary(1, "Folyosó", CORRIDOR)] });
    const { user } = renderApp("/maps");
    const prompt = await screen.findByRole("dialog", { name: "Kérsz egy rövid bevezetőt?" });
    await user.click(within(prompt).getByRole("button", { name: "Nem, köszönöm" }));
    expect(screen.queryByRole("dialog", { name: "Kérsz egy rövid bevezetőt?" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(TOUR_KEY) ?? "{}")).toEqual({
      status: "declined",
    });
  });
});

describe("napi kihívás a pályák oldalán", () => {
  test("a napi kártya és az összegyűjtött csillagok látszanak", async () => {
    const daily = { ...mapSummary(50, "Napi kihívás · 2026. november 6.", LABYRINTH), stars: 2 };
    respond("GET", "/maps", {
      maps: [{ ...mapSummary(1, "Folyosó", CORRIDOR), stars: 3, best: { gold: 2, steps: 4 } }],
    });
    respond("GET", "/maps/daily", { map: daily, date: "2026-11-06" });
    renderApp("/maps");
    const card = await screen.findByRole("region", { name: "Napi kihívás" });
    expect(
      within(card).getByRole("link", { name: "Játék a napi pályán" }).getAttribute("href"),
    ).toBe("/play/50");
    expect(within(card).getByRole("img", { name: "2 / 3 rög" })).toBeTruthy();
    expect(await screen.findByRole("img", { name: "3 / 3 rög" })).toBeTruthy();
    expect(screen.getByText("2 arany · 4 lépés")).toBeTruthy();
    await waitFor(() => expect(callsTo("GET", "/maps/daily")).toHaveLength(1));
  });
});
