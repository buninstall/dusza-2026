import type { Event, MineMap, RobotState, RunResult } from "@minescript/engine";
import { describe, expect, test } from "vitest";
import {
  decodeSketch,
  EMPTY_SKETCH,
  encodeSketch,
  isLampBroken,
  LAMP_MAX_RADIUS,
  lampLight,
  lampRadius,
  lampTrack,
  lampView,
  sketchAfterRun,
} from "../src/play/lamp-mode.ts";

const map: MineMap = {
  rows: 3,
  cols: 5,
  cells: [
    ["empty", "empty", "wall", "empty", "gold"],
    ["empty", "gold", "wall", "empty", "empty"],
    ["empty", "empty", "empty", "empty", "empty"],
  ],
  robot: { row: 0, col: 0 },
  dir: "east",
};

const start: RobotState = { pos: { row: 0, col: 0 }, dir: "east" };

function event(partial: Partial<Event>): Event {
  return {
    index: 0,
    line: 1,
    robot: start,
    path: [],
    discovered: [],
    mined: null,
    gold: 0,
    steps: 1,
    print: null,
    assigned: null,
    ...partial,
  };
}

function result(events: Event[], outcome: RunResult["outcome"] = { kind: "ok" }): RunResult {
  return {
    outcome,
    events,
    gold: events.at(-1)?.gold ?? 0,
    steps: events.length,
    console: [],
    finalRobot: events.at(-1)?.robot ?? start,
    discovered: events.flatMap((item) => [...item.path, ...item.discovered, item.robot.pos]),
  };
}

const bedrock: RunResult["outcome"] = {
  kind: "runtimeError",
  code: "E_BEDROCK_HIT",
  line: 2,
  message: "fal",
};

describe("lámpa fénykör", () => {
  test("a sugár a kibányászott arannyal nő, legfeljebb négyig", () => {
    expect(lampRadius("lamp", 0)).toBe(1);
    expect(lampRadius("lamp", 2)).toBe(3);
    expect(lampRadius("lamp", 9)).toBe(LAMP_MAX_RADIUS);
    expect(lampRadius("dark", 0)).toBe(0);
    expect(lampRadius("dark", 1)).toBe(1);
  });

  test("a fény megvilágítja a falat, de nem megy át rajta", () => {
    const lit = lampLight(map, { row: 0, col: 1 }, 3);
    expect(lit.has("0:2")).toBe(true);
    expect(lit.has("0:3")).toBe(false);
    expect(lit.has("2:2")).toBe(true);
  });

  test("nulla sugárnál csak a robot mezője látszik", () => {
    expect([...lampLight(map, { row: 2, col: 2 }, 0)]).toEqual(["2:2"]);
  });

  test("a térkép szélén nem lép ki", () => {
    const lit = lampLight(map, { row: 0, col: 0 }, 1);
    expect([...lit].sort()).toEqual(["0:0", "0:1", "1:0"]);
  });
});

describe("lámpa a lejátszásban", () => {
  const walk = result([
    event({ robot: { pos: { row: 0, col: 1 }, dir: "east" }, path: [{ row: 0, col: 1 }] }),
    event({ robot: { pos: { row: 1, col: 1 }, dir: "south" }, path: [{ row: 1, col: 1 }] }),
    event({ robot: { pos: { row: 1, col: 1 }, dir: "south" }, mined: { row: 1, col: 1 }, gold: 1 }),
  ]);

  test("képkockánként halmozódik, és a sugár a rög után nő", () => {
    const track = lampTrack(map, start, walk, "lamp");
    expect(track.lit).toHaveLength(4);
    expect(track.radius).toEqual([1, 1, 1, 2]);
    expect(track.lit[0]?.has("1:1")).toBe(false);
    expect(track.lit[3]?.has("2:2")).toBe(true);
    expect(track.lit[2]?.has("2:2")).toBe(false);
  });

  test("futás előtt a vázlat és a kezdő fénykör látszik", () => {
    const view = lampView({
      map,
      start,
      mode: "lamp",
      sketch: { discovered: new Set(["2:4"]), lit: new Set(["1:4"]) },
      frame: null,
      track: null,
      isBroken: false,
    });
    expect(view.discovered.has("2:4")).toBe(true);
    expect(view.discovered.has("0:0")).toBe(true);
    expect(view.lit.has("0:1")).toBe(true);
    expect(view.lit.has("1:4")).toBe(true);
    expect(view.radius).toBe(1);
  });

  test("összetört lámpánál a futás végén a lámpa kialszik, a korábbi vázlat elvész, a futás felfedezett mezői látszanak", () => {
    const track = lampTrack(map, start, walk, "lamp");
    const view = lampView({
      map,
      start,
      mode: "lamp",
      sketch: { discovered: new Set(["2:4"]), lit: new Set() },
      frame: { index: 3, discovered: new Set(["0:0", "0:1", "0:2"]), robot: start, atEnd: true },
      track,
      isBroken: true,
    });
    expect(view.isBroken).toBe(true);
    expect([...view.discovered].sort()).toEqual(["0:0", "0:1", "0:2"]);
    expect(view.discovered.has("2:4")).toBe(false);
    expect(view.lit.size).toBe(0);
  });
});

describe("vázlat", () => {
  test("sikeres futás után a felfedezett és a megvilágított mezők megmaradnak", () => {
    const run = result([
      event({ robot: { pos: { row: 1, col: 0 }, dir: "south" }, path: [{ row: 1, col: 0 }] }),
    ]);
    const track = lampTrack(map, start, run, "lamp");
    const next = sketchAfterRun(
      { discovered: new Set(["2:4"]), lit: new Set() },
      start,
      run,
      track,
    );
    expect(next.discovered.has("2:4")).toBe(true);
    expect(next.discovered.has("1:0")).toBe(true);
    expect(next.lit.has("2:0")).toBe(true);
  });

  test("falnak ütközéskor a vázlat elvész", () => {
    const run = result([event({})], bedrock);
    expect(isLampBroken(run)).toBe(true);
    const next = sketchAfterRun(
      { discovered: new Set(["2:4"]), lit: new Set(["1:4"]) },
      start,
      run,
      lampTrack(map, start, run, "lamp"),
    );
    expect(next).toBe(EMPTY_SKETCH);
  });

  test("más futásidejű hiba nem töri össze a lámpát", () => {
    const run = result([event({})], { ...bedrock, code: "E_NO_GOLD" });
    expect(isLampBroken(run)).toBe(false);
  });

  test("tárolás és visszaolvasás, hibás adatra üres vázlat", () => {
    const sketch = { discovered: new Set(["0:0", "1:2"]), lit: new Set(["2:2"]) };
    expect(decodeSketch(encodeSketch(sketch))).toEqual(sketch);
    expect(decodeSketch("nem json")).toBe(EMPTY_SKETCH);
    expect(decodeSketch(JSON.stringify({ discovered: ["x"], lit: [] }))).toBe(EMPTY_SKETCH);
    expect(decodeSketch(null)).toBe(EMPTY_SKETCH);
  });
});
