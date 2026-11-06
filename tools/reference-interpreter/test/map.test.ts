import { describe, expect, test } from "bun:test";
import { mapInfo, parseMapText } from "../src/map.ts";

const codes = (text: string) =>
  parseMapText(text).diagnostics.map((d) => `${d.span.line}:${d.severity}:${d.code}`);

describe("parseMapText", () => {
  test("a spec példatérképe", () => {
    const result = parseMapText("3 15\n....@..........\n.#############.\n.......@...>...\n");
    expect(result.map?.robot).toEqual({ row: 2, col: 11 });
    expect(result.map?.dir).toBe("east");
    expect(result.map?.cells[1]?.[1]).toBe("wall");
    expect(result.map?.cells[2]?.[11]).toBe("empty");
    expect(result.info).toEqual({ goldTotal: 2, reachableGold: 2, unreachable: [] });
    expect(result.diagnostics).toEqual([]);
  });

  test("üres fájl és fejléchibák", () => {
    expect(codes("")).toEqual(["1:error:MAP_EMPTY"]);
    expect(codes("1  1\n>")).toEqual(["1:error:MAP_HEADER"]);
    expect(codes("0 3\n")).toEqual(["1:error:MAP_DIM_RANGE"]);
    expect(codes("3 16\n")).toEqual(["1:error:MAP_DIM_RANGE"]);
  });

  test("sorhibák, jelek és robotok", () => {
    expect(codes("2 1\n>")).toEqual(["1:error:MAP_ROW_COUNT"]);
    expect(codes("1 2\n>")).toEqual(["2:error:MAP_ROW_LENGTH"]);
    expect(codes("1 2\n>x")).toEqual(["2:error:MAP_BAD_SYMBOL"]);
    expect(codes("1 1\nx")).toEqual(["2:error:MAP_BAD_SYMBOL", "1:error:MAP_NO_ROBOT"]);
    expect(codes("1 3\n><v")).toEqual(["2:error:MAP_MULTIPLE_ROBOTS"]);
  });

  test("figyelmeztetések érvényes térképen", () => {
    expect(codes("1 1\n^")).toEqual(["1:warning:MAP_NO_GOLD"]);
    expect(codes("2 2\nv#\n#@")).toEqual(["3:warning:MAP_UNREACHABLE_GOLD"]);
    expect(parseMapText("1 2\n<@").map?.dir).toBe("west");
  });
});

describe("mapInfo", () => {
  test("BFS 4-szomszédsággal, a falakon nem halad át", () => {
    const map = parseMapText("3 3\n@#@\n.>#\n@..").map;
    if (!map) throw new Error("érvényes térkép kell");
    expect(mapInfo(map)).toEqual({
      goldTotal: 3,
      reachableGold: 2,
      unreachable: [{ row: 0, col: 2 }],
    });
  });
});
