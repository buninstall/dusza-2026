import { describe, expect, test } from "vitest";
import { buildMine, type LevelInput, strataFor } from "../src/maps/deep/build.ts";
import { CORE, TOPSOIL_DEPTH } from "../src/maps/deep/palette.ts";
import { NICHE, OPEN, PANEL, SKY } from "../src/maps/deep/world.ts";

const W = 300;
const PALETTE = Object.fromEntries([
  ["shaft", "#100c0a"],
  ["shaft-hi", "#17120e"],
  ["shade", "#0e0b09"],
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) =>
    ["a", "b", "c"].map((v) => [`cavity-${k}-${v}`, "#3b3024"]),
  ),
]);

function levels(count: number): LevelInput[] {
  return Array.from({ length: count }, (_, i) => ({
    box: { x: 80, y: 120 + i * 100, w: 160, h: 50 },
    pit: { x: 84, y: 124 + i * 100, w: 30, h: 30 },
    stars: [3, 1, -1][i % 3] ?? -1,
    isDaily: false,
    index: i,
    id: i + 1,
  }));
}

function mine(count: number, digId: number | null = null) {
  const list = levels(count);
  return buildMine({
    W,
    H: 160 + count * 100 + 120,
    isNarrow: false,
    plate: { x: 80, y: 40, w: 160, h: 30 },
    front: { x: 80, y: 120 + count * 100, w: 160, h: 40 },
    levels: list,
    palette: PALETTE,
    digId,
  });
}

describe("akna háttér", () => {
  test("a felszín felett ég, alatta kőzet van", () => {
    const m = mine(3);
    expect(m.world.maskAt(10, 5)).toBe(SKY);
    expect(m.groundY).toBe(84);
  });

  test("minden pályakártya helye kőbe vájt fülke, alatta járható tárna", () => {
    const m = mine(3);
    for (const level of m.levels) {
      const { box } = level;
      expect(m.world.maskAt(box.x + 5, box.y + 5)).toBe(NICHE);
      expect(m.world.maskAt(box.x + 20, level.rail - 3)).toBe(OPEN);
      expect(level.rail).toBeGreaterThan(box.y + box.h);
    }
    expect(m.world.maskAt(85, 45)).toBe(PANEL);
  });

  test("az előnézet ablaka mélyebbre van vájva a fülkénél", () => {
    const m = mine(1);
    const pit = m.levels[0]?.pit;
    const box = m.levels[0]?.box;
    if (!pit || !box) return;
    const at = (x: number, y: number) => m.world.pixel(x, y).reduce((a, b) => a + b, 0);
    expect(at(pit.x + 10, pit.y + 10)).toBeLessThan(at(box.x + box.w - 10, box.y + 10));
  });

  test("az új pálya fülkéje azonnal kész, csak alatta a tárna vár ásásra", () => {
    const m = mine(3, 3);
    const level = m.levels[2];
    if (!level) return;
    expect(m.world.maskAt(level.box.x + 60, level.box.y + 10)).toBe(NICHE);
  });

  test("annyi aranyér marad a falban, ahány rög még hiányzik", () => {
    const m = mine(3);
    expect(m.levels.map((l) => l.veins.length)).toEqual([0, 2, 3]);
  });

  test("több pályával mélyebb lesz a bánya", () => {
    expect(mine(5).bottomY).toBeGreaterThan(mine(2).bottomY);
  });

  test("ugyanabból az elrendezésből ugyanaz a bánya épül", () => {
    expect(mine(3).world.data).toEqual(mine(3).world.data);
  });

  test("az új pálya szintje ásás előtt még kőzet, a feltárás megnyitja", () => {
    const m = mine(3, 3);
    const level = m.levels[2];
    expect(m.dig?.level).toBe(level);
    if (!m.dig || !level) return;
    expect(m.world.maskAt(level.box.x + 20, level.rail - 3)).not.toBe(OPEN);
    m.dig.reveal(0, 0, W, m.world.H);
    expect(m.world.maskAt(level.box.x + 20, level.rail - 3)).toBe(OPEN);
  });

  test("az első pálya nem ásható, mert nincs fölötte szint", () => {
    const m = mine(2, 1);
    expect(m.dig).toBeNull();
    expect(m.levels[0]?.isDigging).toBe(false);
  });

  test("a kőzetrétegek ötösével váltanak, a fejezettábla maga jelöli ki a határt", () => {
    const m = mine(12);
    const plain = strataFor(m.levels, [], { x: 80, y: 1400, w: 160, h: 40 }, m.groundY);
    expect(plain[0]).toBe(TOPSOIL_DEPTH);
    expect(plain[1]).toBeGreaterThan(0);
    expect(plain[2]).toBeGreaterThan(plain[1] ?? 0);
    expect(plain[3]).toBe(Number.POSITIVE_INFINITY);
    const plaque = { box: { x: 80, y: 300, w: 160, h: 40 }, stratum: 2 };
    const marked = strataFor(m.levels, [plaque], { x: 80, y: 1400, w: 160, h: 40 }, m.groundY);
    expect(marked[1]).toBe(300 - 8 - m.groundY);
    expect(marked[CORE]).toBe(Number.POSITIVE_INFINITY);
  });
});
