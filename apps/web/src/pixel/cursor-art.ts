import type { PixelRows } from "./pixel-art.ts";

export const CURSOR_HOTSPOT = { x: 0, y: 8 } as const;

export const CURSOR_TONES = {
  k: "steel-edge",
  e: "steel-hi",
  s: "steel",
  w: "ore-lo",
  b: "ore-edge",
} as const;

export const PICKAXE_CURSOR_ART: PixelRows = [
  "....kkeeek......",
  "...keeesssk.....",
  "..keessskk......",
  ".keesskk........",
  "keessk..........",
  "kessk.kk........",
  "eesk.kswk.......",
  "essk.kbswk......",
  "esk...kbwwk.....",
  "ksk....kbwwk....",
  ".k......kbwwk...",
  ".........kbwwk..",
  "..........kbwwk.",
  "...........kbwwk",
  "............kbww",
  ".............kbk",
];
