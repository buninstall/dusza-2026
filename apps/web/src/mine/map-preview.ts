import { type Palette, type PixelRows, pixelPath, type Sprite } from "../pixel/pixel-art.ts";

export const PREVIEW_TILE = 4;
export const PREVIEW_BOX = 120;
const MIN_SCALE = 2;
const MAX_SCALE = 6;

type MicroTile = { rows: PixelRows; palette: Palette };

const FLOOR: MicroTile = {
  rows: ["fffs", "fffs", "fffs", "ssss"],
  palette: { f: "floor", s: "seam" },
};

const WALL: MicroTile = {
  rows: ["hhhd", "hwwd", "hwwd", "dddd"],
  palette: { h: "wall-hi", w: "wall", d: "wall-lo" },
};

const GOLD: MicroTile = {
  rows: ["fffs", "fyos", "fgbs", "ssss"],
  palette: { f: "floor", s: "seam", y: "ore-hi", g: "ore", o: "ore", b: "ore-lo" },
};

const ROBOT_ROWS: Record<string, PixelRows> = {
  "^": ["fLfs", "kvvs", "kvvs", "ssss"],
  ">": ["fffs", "kvvL", "kvvs", "ssss"],
  v: ["fffs", "kvvs", "kvvs", "sLss"],
  "<": ["fffs", "Lvvs", "kvvs", "ssss"],
};

const ROBOT_PALETTE: Palette = { f: "floor", s: "seam", k: "steel-edge", v: "visor", L: "lamp" };

function microTile(symbol: string): MicroTile {
  if (symbol === "#") {
    return WALL;
  }
  if (symbol === "@") {
    return GOLD;
  }
  const robot = ROBOT_ROWS[symbol];
  return robot ? { rows: robot, palette: ROBOT_PALETTE } : FLOOR;
}

export function mapRows(content: string): string[] {
  const [, ...rows] = content.replaceAll("\r\n", "\n").trimEnd().split("\n");
  return rows;
}

export function previewSprite(content: string): Sprite {
  const rows = mapRows(content);
  const cols = Math.max(0, ...rows.map((row) => row.length));
  const buckets = new Map<string, string[]>();
  rows.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      const tile = microTile(symbol);
      for (const [char, tone] of Object.entries(tile.palette)) {
        const path = pixelPath(tile.rows, char, x * PREVIEW_TILE, y * PREVIEW_TILE);
        if (path) {
          buckets.set(tone, [...(buckets.get(tone) ?? []), path]);
        }
      }
    });
  });
  return {
    width: cols * PREVIEW_TILE,
    height: rows.length * PREVIEW_TILE,
    layers: [...buckets].map(([tone, paths]) => ({ tone, path: paths.join("") })),
  };
}

export function previewScale(sprite: Sprite): number {
  const longest = Math.max(sprite.width, sprite.height, 1);
  return Math.min(Math.max(Math.floor(PREVIEW_BOX / longest), MIN_SCALE), MAX_SCALE);
}
