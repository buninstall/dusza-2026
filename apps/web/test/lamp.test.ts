import { describe, expect, test } from "vitest";
import { createLighting } from "../src/auth/lamp/lighting.ts";
import { GOLD, generateMine, HOLE, isOpen, planTour } from "../src/auth/lamp/mine.ts";
import { createWalker, MINE_TIME } from "../src/auth/lamp/walker.ts";

const HOLE_RECT = { c0: 10, c1: 19, r0: 5, r1: 14 };

function mineFixture(upward = false) {
  return generateMine({ cols: 30, rows: 20, hole: HOLE_RECT, seed: 7, branchEvery: 6, upward });
}

describe("lámpás bánya", () => {
  test("a panel helye tömör, körülötte végig járható folyosó fut", () => {
    const mine = mineFixture();
    expect(mine.at(12, 8)).toBe(HOLE);
    for (let c = HOLE_RECT.c0 - 1; c <= HOLE_RECT.c1 + 1; c += 1) {
      expect(isOpen(mine.at(c, HOLE_RECT.r0 - 1))).toBe(true);
      expect(isOpen(mine.at(c, HOLE_RECT.r1 + 1))).toBe(true);
    }
    expect(mine.golds.length).toBeGreaterThan(2);
    for (const [c, r] of mine.golds) expect(mine.at(c, r)).toBe(GOLD);
  });

  test("ugyanabból a magból ugyanaz a bánya lesz", () => {
    expect(mineFixture().grid).toEqual(mineFixture().grid);
    expect(mineFixture(true).grid).not.toEqual(mineFixture().grid);
  });

  test("a körút minden aranyat elér és visszatér a kiindulóponthoz", () => {
    const mine = mineFixture();
    const start = [HOLE_RECT.c0 - 1, 9] as const;
    const legs = planTour(mine, start, [15, 10]);
    const ends = legs.map((leg) => leg[leg.length - 1]);
    for (const gold of mine.golds) expect(ends).toContainEqual(gold);
    expect(ends[ends.length - 1]).toEqual(start);
    for (const leg of legs) {
      for (let i = 1; i < leg.length; i += 1) {
        const [c0 = 0, r0 = 0] = leg[i - 1] ?? [];
        const [c1 = 0, r1 = 0] = leg[i] ?? [];
        expect(Math.abs(c1 - c0) + Math.abs(r1 - r0)).toBe(1);
      }
    }
  });
});

describe("robot a tárnában", () => {
  test("aranyra érve kiássa, a kör végén újraindul", () => {
    const mined: string[] = [];
    let loops = 0;
    const gold = new Set(["2,0"]);
    const walker = createWalker(
      [
        [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
        [
          [2, 0],
          [1, 0],
          [0, 0],
        ],
      ],
      {
        speed: 4,
        seed: 1,
        sweepChance: 0,
        isGold: (c, r) => gold.has(`${c},${r}`),
        isJunction: () => false,
        onMine: (c, r) => {
          mined.push(`${c},${r}`);
          gold.delete(`${c},${r}`);
        },
        onLoop: () => {
          loops += 1;
        },
      },
    );
    for (let t = 0; t < 2 + MINE_TIME; t += 1 / 60) walker.update(1 / 60);
    expect(mined).toEqual(["2,0"]);
    for (let t = 0; t < 3; t += 1 / 60) walker.update(1 / 60);
    expect(loops).toBeGreaterThan(0);
    expect(walker.state.x).toBeGreaterThanOrEqual(0);
  });
});

describe("fény és felfedés", () => {
  const W = 40;
  const H = 10;
  const wall = (x: number) => x >= 20 && x < 30;

  test("a fal mögé nem jut fény, elé igen", () => {
    const lighting = createLighting(W, H, (x) => wall(x), 2);
    lighting.compute([
      { x: 4, y: 5, radius: 60, intensity: 1, color: [1, 1, 1], falloff: 1, hasShadow: true },
    ]);
    expect(lighting.at(12, 5)).toBeGreaterThan(0.3);
    expect(lighting.at(35, 5)).toBe(0);
  });

  test("a még fel nem tárt rész sötét marad, a feltárt kirajzolódik", () => {
    const lighting = createLighting(W, H, () => false, 2);
    lighting.compute([{ x: 20, y: 5, radius: 80, intensity: 1, color: [1, 1, 1], falloff: 1 }]);
    const albedo = new Uint8ClampedArray(W * H * 4).fill(200);
    const shade = (revealed: number) => {
      const out = new Uint8ClampedArray(W * H * 4);
      lighting.shade(albedo, out, {
        levels: 5,
        memory: () => 0,
        memoryTint: [1, 1, 1],
        memoryLevel: 0,
        memoryDensity: 0,
        ambient: () => 0,
        reveal: () => revealed,
        base: [7, 6, 5],
      });
      return out;
    };
    expect(shade(0)[(5 * W + 20) * 4]).toBe(7);
    expect(shade(1)[(5 * W + 20) * 4]).toBeGreaterThan(100);
    const half = shade(0.5);
    const shown = Array.from({ length: W }, (_, x) => half[(5 * W + x) * 4] ?? 0).filter(
      (v) => v > 7,
    );
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(W);
  });

  test("a látható sávon kívüli tartalék sorokat nem árnyalja", () => {
    const lighting = createLighting(W, H, () => false, 2);
    lighting.compute([{ x: 20, y: 5, radius: 80, intensity: 1, color: [1, 1, 1], falloff: 1 }]);
    const albedo = new Uint8ClampedArray(W * H * 4).fill(200);
    const out = new Uint8ClampedArray(W * H * 4);
    lighting.shade(albedo, out, {
      levels: 5,
      memory: () => 0,
      memoryTint: [1, 1, 1],
      memoryLevel: 0,
      memoryDensity: 0,
      ambient: () => 0,
      reveal: () => 1,
      base: [7, 6, 5],
      bounds: { width: 30, height: 6 },
    });
    expect(out[(5 * W + 20) * 4 + 3]).toBe(255);
    expect(out[(5 * W + 32) * 4 + 3]).toBe(0);
    expect(out[(8 * W + 20) * 4 + 3]).toBe(0);
  });
});
