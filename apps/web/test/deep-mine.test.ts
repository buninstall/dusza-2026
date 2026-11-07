import { describe, expect, test } from "vitest";
import { buildMine, type LevelInput } from "../src/maps/deep/build.ts";
import { NICHE, OPEN, PANEL, SKY } from "../src/maps/deep/world.ts";

const W = 300;

function levels(count: number): LevelInput[] {
  return Array.from({ length: count }, (_, i) => ({
    box: { x: 80, y: 120 + i * 100, w: 160, h: 50 },
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
    palette: {},
    digId,
  });
}

describe("akna háttér", () => {
  test("a felszín felett ég, alatta kőzet van", () => {
    const m = mine(3);
    expect(m.world.maskAt(10, 5)).toBe(SKY);
    expect(m.groundY).toBe(75);
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
});
