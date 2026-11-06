import type { MineMap } from "@minescript/engine";
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { clampPos, moveFocus, samePos } from "../src/mine/grid-nav.ts";
import { mapRows, previewScale, previewSprite } from "../src/mine/map-preview.ts";
import { nextQuarterTurns, quarterIndex, useQuarterTurns } from "../src/mine/quarter-turns.ts";
import { buildTiles, describeTile, posKey, tileKind } from "../src/mine/tiles-model.ts";

const map: MineMap = {
  rows: 2,
  cols: 3,
  cells: [
    ["empty", "gold", "wall"],
    ["empty", "gold", "empty"],
  ],
  robot: { row: 0, col: 0 },
  dir: "east",
};

const robot = { pos: { row: 0, col: 0 }, dir: "east" as const };

function key(event: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean }>) {
  return { key: "", ctrlKey: false, metaKey: false, ...event };
}

describe("csempemodell", () => {
  test("futás nélkül minden mező látszik", () => {
    const tiles = buildTiles(map, robot, null);
    expect(tiles.flat().every((tile) => tile.lighting === "lit")).toBe(true);
    expect(tiles[0]?.[0]?.hasRobot).toBe(true);
    expect(describeTile(tiles[0]?.[1] ?? never(), robot)).toBe("1. sor, 2. oszlop: arany");
    expect(describeTile(tiles[0]?.[0] ?? never(), robot)).toBe(
      "1. sor, 1. oszlop: robot, kelet felé",
    );
  });

  test("lámpafényben a felderítetlen mező sötét, a szomszéd felé dithert kap", () => {
    const exploration = {
      discovered: new Set(["0:0", "0:1"]),
      mined: new Set<string>(),
      mode: "lamp" as const,
    };
    const tiles = buildTiles(map, robot, exploration);
    const dark = tiles[1]?.[1] ?? never();
    expect(dark.lighting).toBe("dark");
    expect(dark.fringe).toEqual(["north"]);
    expect(describeTile(dark, robot)).toBe("2. sor, 2. oszlop: felderítetlen");
    expect(tiles[0]?.[2]?.fringe).toEqual(["west"]);
  });

  test("teljes nézetben a felderítetlen mező látszik, de jelölve van", () => {
    const exploration = {
      discovered: new Set(["0:0"]),
      mined: new Set(["0:1"]),
      mode: "full" as const,
    };
    const tiles = buildTiles(map, robot, exploration);
    expect(describeTile(tiles[0]?.[2] ?? never(), robot)).toBe(
      "1. sor, 3. oszlop: fal, még nem felfedezett",
    );
    expect(tiles[0]?.[1]?.kind).toBe("mined");
    expect(describeTile(tiles[0]?.[1] ?? never(), robot)).toBe(
      "1. sor, 2. oszlop: üres kamra, kibányászva, még nem felfedezett",
    );
  });

  test("aranyon álló robot külön címkét kap", () => {
    const onGold = { pos: { row: 1, col: 1 }, dir: "south" as const };
    const tiles = buildTiles(map, onGold, null);
    expect(describeTile(tiles[1]?.[1] ?? never(), onGold)).toBe(
      "2. sor, 2. oszlop: robot, dél felé, aranyon áll",
    );
  });

  test("a mező fajtája a bányászás után üres", () => {
    expect(tileKind("gold", false)).toBe("gold");
    expect(tileKind("gold", true)).toBe("mined");
    expect(tileKind("wall", false)).toBe("wall");
    expect(tileKind("empty", true)).toBe("floor");
    expect(posKey({ row: 3, col: 4 })).toBe("3:4");
  });
});

describe("rácsnavigáció", () => {
  const focus = { row: 1, col: 1 };

  test("nyilak, Home, End, Ctrl+Home, Ctrl+End, PageUp, PageDown", () => {
    expect(moveFocus(key({ key: "ArrowUp" }), focus, 3, 3)).toEqual({ row: 0, col: 1 });
    expect(moveFocus(key({ key: "ArrowDown" }), focus, 3, 3)).toEqual({ row: 2, col: 1 });
    expect(moveFocus(key({ key: "ArrowLeft" }), focus, 3, 3)).toEqual({ row: 1, col: 0 });
    expect(moveFocus(key({ key: "ArrowRight" }), focus, 3, 3)).toEqual({ row: 1, col: 2 });
    expect(moveFocus(key({ key: "Home" }), focus, 3, 3)).toEqual({ row: 1, col: 0 });
    expect(moveFocus(key({ key: "End" }), focus, 3, 3)).toEqual({ row: 1, col: 2 });
    expect(moveFocus(key({ key: "Home", ctrlKey: true }), focus, 3, 3)).toEqual({ row: 0, col: 0 });
    expect(moveFocus(key({ key: "End", metaKey: true }), focus, 3, 3)).toEqual({ row: 2, col: 2 });
    expect(moveFocus(key({ key: "PageUp" }), focus, 3, 3)).toEqual({ row: 0, col: 1 });
    expect(moveFocus(key({ key: "PageDown" }), focus, 3, 3)).toEqual({ row: 2, col: 1 });
    expect(moveFocus(key({ key: "Enter" }), focus, 3, 3)).toBeNull();
  });

  test("a szélén nem lép ki a rácsból", () => {
    expect(moveFocus(key({ key: "ArrowUp" }), { row: 0, col: 0 }, 2, 2)).toEqual({
      row: 0,
      col: 0,
    });
    expect(clampPos({ row: 9, col: -2 }, 3, 4)).toEqual({ row: 2, col: 0 });
    expect(samePos({ row: 1, col: 2 }, { row: 1, col: 2 })).toBe(true);
  });
});

describe("negyedfordulatok", () => {
  test("a legrövidebb úton fordul, 180°-nál balra", () => {
    expect(quarterIndex("west")).toBe(3);
    expect(nextQuarterTurns(0, "east")).toBe(1);
    expect(nextQuarterTurns(3, "north")).toBe(4);
    expect(nextQuarterTurns(0, "west")).toBe(-1);
    expect(nextQuarterTurns(1, "west")).toBe(-1);
    expect(nextQuarterTurns(-2, "north")).toBe(-4);
  });

  test("a hook halmozza a fordulatokat", () => {
    const { result, rerender } = renderHook(({ dir }) => useQuarterTurns(dir), {
      initialProps: { dir: "east" as "east" | "north" | "west" | "south" },
    });
    expect(result.current).toBe(1);
    rerender({ dir: "north" });
    expect(result.current).toBe(0);
    rerender({ dir: "west" });
    expect(result.current).toBe(-1);
  });
});

describe("térkép-előnézet", () => {
  test("a pixeles előnézet a térkép méretét követi", () => {
    const preview = previewSprite("2 3\n>.@\n#.v\n");
    expect([preview.width, preview.height]).toEqual([12, 8]);
    expect(preview.layers.map((layer) => layer.tone)).toContain("ore");
    expect(mapRows("1 2\r\n>.\r\n")).toEqual([">."]);
  });

  test("a kis térkép nagyobb egész szorzót kap", () => {
    expect(previewScale(previewSprite("1 2\n>.\n"))).toBe(6);
    expect(previewScale(previewSprite(`15 15\n${">..............\n".repeat(15)}`))).toBe(2);
  });
});

function never(): never {
  throw new Error("Hiányzó csempe a tesztben.");
}
