import { describe, expect, test } from "vitest";
import {
  FADE_MS,
  fadeLevel,
  isSettled,
  lightSpot,
  mixSpot,
  parseRgb,
  REVEAL_MS,
  scheduleReveal,
  shadeInto,
} from "../src/mine/lamp-shade.ts";
import { TILE_SIZE } from "../src/pixel/tiles.ts";

const origin = { row: 0, col: 0 };

describe("felfedés animációja", () => {
  test("az új mezők a robottól távolodva, hullámban jelennek meg", () => {
    const state = scheduleReveal(new Map(), new Set(["0:0", "0:3"]), origin, 1000, false);
    const near = state.get("0:0");
    const far = state.get("0:3");
    expect(near?.delay).toBe(0);
    expect(far?.delay).toBeGreaterThan(0);
    expect(fadeLevel(near, 1000)).toBe(0);
    expect(fadeLevel(near, 1000 + REVEAL_MS)).toBe(1);
    expect(fadeLevel(far, 1000 + REVEAL_MS)).toBeLessThan(1);
    expect(isSettled(state, 1000)).toBe(false);
    expect(isSettled(state, 10_000)).toBe(true);
  });

  test("a már látható mező nem kezdi újra", () => {
    const first = scheduleReveal(new Map(), new Set(["0:1"]), origin, 0, false);
    const again = scheduleReveal(first, new Set(["0:1"]), origin, 300, false);
    expect(again.get("0:1")).toBe(first.get("0:1"));
  });

  test("az eltűnő mező elsötétül, majd kikerül", () => {
    const shown = scheduleReveal(new Map(), new Set(["0:1"]), origin, 0, true);
    const fading = scheduleReveal(shown, new Set(), origin, 100, false);
    const fade = fading.get("0:1");
    expect(fade?.to).toBe(0);
    expect(fadeLevel(fade, 100 + FADE_MS * 2)).toBe(0);
    expect(scheduleReveal(fading, new Set(), origin, 100 + FADE_MS * 2, false).size).toBe(0);
  });

  test("csökkentett mozgásnál azonnal látszik", () => {
    const state = scheduleReveal(new Map(), new Set(["2:2"]), origin, 50, true);
    expect(fadeLevel(state.get("2:2"), 50)).toBe(1);
  });
});

describe("lámpafény", () => {
  test("a fényfolt a robot előtt van, a sugara az akkuval nő", () => {
    const small = lightSpot({ row: 1, col: 1 }, "east", 1);
    const big = lightSpot({ row: 1, col: 1 }, "east", 3);
    expect(small.x).toBeGreaterThan(1.5 * TILE_SIZE);
    expect(small.y).toBe(1.5 * TILE_SIZE);
    expect(big.radius).toBeGreaterThan(small.radius);
    expect(lightSpot({ row: 0, col: 0 }, "north", 0).radius).toBeGreaterThan(0);
  });

  test("a fényfolt simán követi a robotot", () => {
    const from = lightSpot({ row: 0, col: 0 }, "east", 1);
    const to = lightSpot({ row: 0, col: 4 }, "east", 1);
    const half = mixSpot(from, to, 0.5);
    expect(half.x).toBeGreaterThan(from.x);
    expect(half.x).toBeLessThan(to.x);
    expect(mixSpot(from, to, 1)).toEqual(to);
  });

  test("a rejtett mező tömör sötét, a felfedett a fény közepén átlátszik", () => {
    const out = new Uint8ClampedArray(2 * TILE_SIZE * TILE_SIZE * 4);
    shadeInto(
      {
        cols: 2,
        rows: 1,
        level: (_row, col) => (col === 0 ? 1 : 0),
        isSeen: () => true,
        spot: lightSpot({ row: 0, col: 0 }, "north", 2),
        intensity: 1,
        void: [7, 6, 5],
        ember: [240, 178, 50],
        glow: [240, 178, 50],
      },
      out,
    );
    const pixel = (x: number, y: number) =>
      out.slice((y * 2 * TILE_SIZE + x) * 4, (y * 2 * TILE_SIZE + x) * 4 + 4);
    let opaque = 0;
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        opaque += pixel(x, y)[3] === 255 ? 1 : 0;
      }
    }
    expect(opaque).toBeLessThan((TILE_SIZE * TILE_SIZE) / 4);
    expect([...pixel(TILE_SIZE + 8, 8)]).toEqual([7, 6, 5, 255]);
  });

  test("szín beolvasása a tokenből", () => {
    expect(parseRgb(" #070605 ")).toEqual([7, 6, 5]);
    expect(parseRgb("var(--x)")).toBeNull();
  });
});
