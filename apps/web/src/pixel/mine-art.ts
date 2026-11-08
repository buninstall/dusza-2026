import { SCENE_ART } from "./mine-art-scene.ts";
import { TILE_ART } from "./mine-art-tiles.ts";
import type { PixelRows } from "./pixel-art.ts";

export type ToneArt = {
  readonly rows: PixelRows;
  readonly tones: Readonly<Record<string, string>>;
};

export const MINE_ART = { ...SCENE_ART, ...TILE_ART } as const;

export type MineArtName = keyof typeof MINE_ART;

export const MINE_META = {
  cart: { load: { x: 3, y: -2 } },
  lantern: { flame: { x: 3, y: 7 }, glow: { x: 5, y: 10 }, hang: { x: 5, y: 0 } },
  bulb: { glow: { x: 3, y: 5 }, hang: { x: 3, y: 0 } },
  flood: { glow: { x: 8, y: 7 }, dir: [0.71, 0.71] },
} as const;
