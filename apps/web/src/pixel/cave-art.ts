import type { PixelRows } from "./pixel-art.ts";

export const GEM_TONES = { G: "gem", C: "gem-hi", D: "gem-lo", w: "glint" } as const;

export const PEBBLE_FLOOR_ART: PixelRows = [
  "fffffffffffffffs",
  "fffffffffffffffs",
  "fffffffffffffffs",
  "fffhhffffffflffs",
  "fffllffffffffffs",
  "ffffffffffffhffs",
  "ffffffflfffffffs",
  "fffffhfffffffffs",
  "ffffffffffhhhffs",
  "fflffffffflllffs",
  "fffffffffffffffs",
  "ffffffhffffffffs",
  "fffffflfffffflfs",
  "fffhffffflfffffs",
  "fffffffffffffffs",
  "ssssssssssssssss",
];

export const CRACKED_FLOOR_ART: PixelRows = [
  "fffffffffffffffs",
  "fffffffffffffffs",
  "fffffffffffffffs",
  "ffffffffffffflfs",
  "ffssflfffffffffs",
  "fffhssfffffffffs",
  "ffffffsffffffffs",
  "fffffffssffffffs",
  "ffffffffhsfffffs",
  "ffffffffflsffffs",
  "ffffffffffsffffs",
  "fffffffffffsfffs",
  "fflfffffffflsffs",
  "ffffffffffffhffs",
  "fffffffffffffffs",
  "ssssssssssssssss",
];

export const CRYSTAL_FLOOR_ART: PixelRows = [
  "fffffffffffffffs",
  "fffffffffffffffs",
  "ffffffffffffhffs",
  "ffffhffffffffffs",
  "ffffffflfffffffs",
  "fffffffffffffffs",
  "fflffffffffffffs",
  "fffffffffffwfffs",
  "fffffffffffCfffs",
  "ffffffffffCGGffs",
  "ffffCfffffCGDffs",
  "fffCGDfffCGGDDfs",
  "ffflllffflllllfs",
  "fffffffffffffffs",
  "fffffffffffffffs",
  "ssssssssssssssss",
];

export const CRACKED_WALL_ART: PixelRows = [
  "hhshhhsmhhhhhhsm",
  "hsssssdmhdmsssdm",
  "hsssmsdmhsdmssdm",
  "hssmssdmhsdmssdm",
  "hsssssdmhssdmsdm",
  "hsssssdmhsssmsdm",
  "sddddddmsddddddm",
  "mmmmmmmmmmmmmmmm",
  "hhsmhhhhhhsmhhdd",
  "ssdmhsmsssdmhsss",
  "ssdmhssmssdmhsss",
  "ssdmhssmmsdmhsss",
  "smdmhsssmsdmhsss",
  "ssdmhsssmsdmhsss",
  "dddmsddddddmsddd",
  "mmmmmmmmmmmmmmmm",
];
