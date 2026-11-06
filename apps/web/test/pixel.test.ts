import { describe, expect, test } from "vitest";
import { ICON_ART, ICON_GRID, ICON_NAMES, iconPath } from "../src/pixel/icons.ts";
import { LOGO_MARK } from "../src/pixel/logo-art.ts";
import {
  mirror,
  pixelPath,
  rotateClockwise,
  rotateTimes,
  sprite,
  toneFill,
} from "../src/pixel/pixel-art.ts";
import {
  FRINGE_SIDES,
  SPRITE_ID,
  TILE_SIZE,
  TILE_SPRITES,
  tileVariant,
} from "../src/pixel/tiles.ts";

describe("pixel art", () => {
  test("a vízszintes futamok egy-egy téglalappá olvadnak össze", () => {
    expect(pixelPath(["##.#"], "#")).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
    expect(pixelPath(["#"], "#", 4, 8)).toBe("M4 8h1v1h-1z");
    expect(pixelPath(["..."], "#")).toBe("");
  });

  test("a sprite rétegei a palettát követik, az átlátszó jel kimarad", () => {
    const built = sprite(["ab", ".a"], { a: "ore", b: "wall" });
    expect(built.width).toBe(2);
    expect(built.height).toBe(2);
    expect(built.layers.map((layer) => layer.tone)).toEqual(["ore", "wall"]);
  });

  test("hibás pixel art azonnal kiderül", () => {
    expect(() => sprite(["ab", "a"], { a: "ore", b: "wall" })).toThrow(/width/);
    expect(() => sprite(["ax"], { a: "ore" })).toThrow(/"x"/);
  });

  test("forgatás és tükrözés veszteségmentes", () => {
    const rows = ["ab", "cd"];
    expect(rotateClockwise(rows)).toEqual(["ca", "db"]);
    expect(rotateTimes(rows, 4)).toEqual(rows);
    expect(rotateTimes(rows, -1)).toEqual(rotateTimes(rows, 3));
    expect(mirror(rows)).toEqual(["ba", "dc"]);
    expect(toneFill("ore")).toBe("var(--px-ore)");
  });

  test("minden csempe 16×16-os rácson készült", () => {
    const tiles = [
      ...TILE_SPRITES.floor,
      ...TILE_SPRITES.wall,
      TILE_SPRITES.gold,
      TILE_SPRITES.dug,
      TILE_SPRITES.robot,
      TILE_SPRITES.shroud,
      TILE_SPRITES.sparkle,
      ...FRINGE_SIDES.map((side) => TILE_SPRITES.fringe[side]),
      LOGO_MARK,
    ];
    for (const tile of tiles) {
      expect([tile.width, tile.height]).toEqual([TILE_SIZE, TILE_SIZE]);
      expect(tile.layers.length).toBeGreaterThan(0);
    }
  });

  test("az ikonok 10×10-esek, az útvonaluk gyorsítótárból jön", () => {
    for (const name of ICON_NAMES) {
      const rows = ICON_ART[name];
      expect(rows).toHaveLength(ICON_GRID);
      expect(rows.every((row) => row.length === ICON_GRID)).toBe(true);
      expect(iconPath(name)).toMatch(/^M/);
      expect(iconPath(name)).toBe(iconPath(name));
    }
  });

  test("a csempeváltozat determinisztikus és a tartományban marad", () => {
    for (let row = 0; row < 15; row += 1) {
      for (let col = 0; col < 15; col += 1) {
        const variant = tileVariant(row, col, 3);
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(3);
        expect(tileVariant(row, col, 3)).toBe(variant);
      }
    }
    expect(SPRITE_ID.floor(2)).toBe("ms-floor-2");
    expect(SPRITE_ID.fringe("west")).toBe("ms-fringe-west");
  });
});
