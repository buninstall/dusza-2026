import type { MineMap } from "@minescript/engine";
import { describe, expect, test } from "vitest";
import { rustFraction, rustLevel } from "../src/lib/rust-wear.ts";
import {
  anchorCenter,
  fitScale,
  followCenter,
  placeView,
  windowSize,
  zoomScale,
} from "../src/mine/scene/camera.ts";
import { sceneLayout, T } from "../src/mine/scene/layout.ts";
import {
  kindsOf,
  SIGHT_HIDDEN,
  SIGHT_KNOWN,
  SIGHT_SHROUD,
  sightOf,
} from "../src/mine/scene/paint-board.ts";
import { cartLevel } from "../src/mine/scene/paint-fixtures.ts";

const MAP: MineMap = {
  rows: 2,
  cols: 3,
  cells: [
    ["empty", "wall", "gold"],
    ["empty", "empty", "gold"],
  ],
} as unknown as MineMap;

describe("bányajelenet kamerája", () => {
  test("a keret egész pixelszorzóval fér be, retinán fél lépcsőkkel", () => {
    const frame = { x0: 0, y0: 0, x1: 200, y1: 100 };
    expect(fitScale(frame, { width: 700, height: 400 })).toBe(3);
    expect(fitScale(frame, { width: 700, height: 400 }, 0.5)).toBe(3.5);
    expect(fitScale(frame, { width: 50, height: 20 })).toBe(1);
  });

  test("a nagyítás a szorzót kerekíti, és sosem megy egy alá", () => {
    expect(zoomScale(3, 1.25)).toBe(4);
    expect(zoomScale(3, 1.25, 0.5)).toBe(4);
    expect(zoomScale(2, 1.5, 0.5)).toBe(3);
    expect(zoomScale(1, 0.2)).toBe(1);
  });

  test("a nézet a világon belül marad, a kisebb világot középre teszi", () => {
    const view = placeView({ x: 10, y: 10 }, { width: 300, height: 300 }, 3, {
      width: 400,
      height: 50,
    });
    expect(windowSize({ width: 300, height: 300 }, 3)).toEqual({ width: 100, height: 100 });
    expect(view.x).toBe(0);
    expect(view.y).toBe(-25);
  });

  test("a kurzor alatti pont a nagyítás után is a kurzor alatt marad", () => {
    const center = anchorCenter({ x: 100, y: 100 }, { x: 120, y: 80 }, 2, 4);
    expect(center).toEqual({ x: 110, y: 90 });
  });

  test("a követett mező a kilógás mértékével húzza a nézetet", () => {
    const view = { scale: 2, x: 0, y: 0, width: 100, height: 100 };
    const next = followCenter({ x: 50, y: 50 }, view, { x0: 110, y0: 10, x1: 126, y1: 26 }, 4);
    expect(next).toEqual({ x: 80, y: 50 });
  });
});

describe("bányajelenet elrendezése", () => {
  test("a tábla a világ margóin belül ül, a keret körbeveszi", () => {
    const layout = sceneLayout(3, 2);
    expect(layout.bw).toBe(3 * T);
    expect(layout.postR).toBe(layout.bx + layout.bw);
    expect(layout.frame.x0).toBeLessThan(layout.postL);
    expect(layout.frame.y1).toBeGreaterThan(layout.railY);
    expect(layout.W).toBeGreaterThan(layout.frame.x1);
  });

  test("a csille a kibányászott arany arányában telik", () => {
    expect(cartLevel(0, 8)).toBe(0);
    expect(cartLevel(1, 8)).toBe(1);
    expect(cartLevel(5, 8)).toBe(2);
    expect(cartLevel(8, 8)).toBe(3);
    expect(cartLevel(3, 0)).toBe(0);
  });
});

describe("látótér a játék szabályai szerint", () => {
  test("futás előtt minden mező látszik", () => {
    expect([...sightOf(MAP, null, null)]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  test("lámpafényben a felfedezetlen mező rejtett, teljes térképen fátyolos", () => {
    const lamp = {
      discovered: new Set(["0:0"]),
      mined: new Set<string>(),
      mode: "lamp" as const,
      lit: new Set(["1:0"]),
    };
    const sight = sightOf(MAP, lamp, "1:1");
    expect(sight[0]).toBe(SIGHT_KNOWN);
    expect(sight[3]).toBe(SIGHT_KNOWN);
    expect(sight[4]).toBe(SIGHT_KNOWN);
    expect(sight[2]).toBe(SIGHT_HIDDEN);
    const full = sightOf(MAP, { ...lamp, mode: "full" }, null);
    expect(full[2]).toBe(SIGHT_SHROUD);
  });

  test("a kibányászott arany kiásott mezőként rajzolódik", () => {
    const kinds = kindsOf(MAP, { discovered: new Set(), mined: new Set(["0:2"]), mode: "lamp" });
    expect(kinds).toEqual(["floor", "wall", "mined", "floor", "floor", "gold"]);
  });
});

describe("rozsdásodás", () => {
  test("lassan nő, egy óra után kétharmad körül jár, és sosem lépi túl a maximumot", () => {
    expect(rustFraction(0)).toBe(0);
    expect(rustFraction(3600)).toBeCloseTo(0.632, 2);
    expect(rustFraction(1e9)).toBeLessThanOrEqual(1);
    expect(rustFraction(-50)).toBe(0);
  });

  test("öt lépcsős szintre képez", () => {
    expect(rustLevel(0)).toBe(0);
    expect(rustLevel(0.5)).toBe(2);
    expect(rustLevel(1)).toBe(4);
  });
});
