import { beforeAll, describe, expect, test } from "bun:test";
import { type Engine, formatPos, isRuntimeError, isSyntaxError } from "../src/index.ts";
import { loadEngine } from "./load.ts";

const SPEC_MAP = "3 15\n....@..........\n.#############.\n.......@...>...\n";

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

describe("parseMap", () => {
  test("a spec példatérképe érvényes", () => {
    const result = engine.parseMap(SPEC_MAP);
    expect(result.diagnostics).toEqual([]);
    expect(result.map?.rows).toBe(3);
    expect(result.map?.cols).toBe(15);
    expect(result.map?.robot).toEqual({ row: 2, col: 11 });
    expect(result.map?.dir).toBe("east");
  });

  test("két robot hibát ad a második robot sorában", () => {
    const result = engine.parseMap("1 2\n><");
    expect(result.map).toBeNull();
    expect(result.diagnostics.map((d) => [d.code, d.span.line])).toEqual([
      ["MAP_MULTIPLE_ROBOTS", 2],
    ]);
  });

  test("a hibás fejléc magyar üzenetet ad", () => {
    const result = engine.parseMap("1  2\n>.");
    expect(result.diagnostics[0]?.code).toBe("MAP_HEADER");
    expect(result.diagnostics[0]?.message).toContain("szóköz");
  });

  test("a túl nagy térkép hibás", () => {
    expect(engine.parseMap("1 16\n>...............").diagnostics[0]?.code).toBe("MAP_DIM_RANGE");
  });
});

describe("serializeMap és mapInfo", () => {
  test("oda-vissza alakítás változatlan", () => {
    const map = engine.parseMap(SPEC_MAP).map;
    if (!map) throw new Error("érvényes térkép kell");
    expect(engine.serializeMap(map)).toBe(SPEC_MAP);
  });

  test("az elérhetetlen aranyat jelzi", () => {
    const map = engine.parseMap("1 3\n>#@").map;
    if (!map) throw new Error("érvényes térkép kell");
    expect(engine.mapInfo(map)).toEqual({
      goldTotal: 1,
      reachableGold: 0,
      unreachable: [{ row: 0, col: 2 }],
    });
  });

  test("ellentmondásos térképre magyar hibát dob", () => {
    const map = engine.parseMap("1 1\n>").map;
    if (!map) throw new Error("érvényes térkép kell");
    expect(() => engine.serializeMap({ ...map, rows: 2 })).toThrow(/térkép/);
  });
});

describe("run", () => {
  test("az üres program 0 lépésben véget ér", () => {
    const result = engine.run("", SPEC_MAP);
    expect(result.outcome).toEqual({ kind: "ok" });
    expect(result.steps).toBe(0);
    expect(result.finalRobot).toEqual({ pos: { row: 2, col: 11 }, dir: "east" });
  });

  test("hibás térképre magyar hibát dob", () => {
    expect(() => engine.run("", "")).toThrow(/A térkép hibás/);
  });

  test("a szintaktikailag hibás program nem fut", () => {
    const result = engine.run("Step forward 1", SPEC_MAP);
    expect(isSyntaxError(result.outcome)).toBe(true);
    expect(isRuntimeError(result.outcome)).toBe(false);
  });
});

describe("segédfüggvények", () => {
  test("formatPos 1-alapú", () => {
    expect(formatPos({ row: 0, col: 4 })).toBe("1. sor, 5. oszlop");
  });

  test("a kulcsszavak listája teljes", () => {
    expect(engine.keywords()).toHaveLength(18);
    expect(engine.version()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("a kiegészítés a 8 utasítást adja", () => {
    expect(engine.complete("", 0).map((item) => item.label)).toContain("step forward");
  });
});
