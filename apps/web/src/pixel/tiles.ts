import { type PixelRows, rotateTimes, type Sprite, sprite } from "./pixel-art.ts";

export const TILE_SIZE = 16;

const FLOOR_TONES = { f: "floor", l: "floor-lo", h: "floor-hi", s: "seam" } as const;
const WALL_TONES = { h: "wall-hi", s: "wall", d: "wall-lo", m: "mortar" } as const;
const ORE_TONES = {
  o: "ore-edge",
  g: "ore",
  y: "ore-hi",
  b: "ore-lo",
  w: "glint",
} as const;
const ROBOT_TONES = {
  k: "steel-edge",
  e: "steel-hi",
  a: "steel",
  d: "steel-lo",
  t: "tread",
  r: "tread-hi",
  v: "visor",
  L: "lamp",
  B: "beam",
} as const;

const FLOOR_ART: readonly PixelRows[] = [
  [
    "fffffffffffffffs",
    "fffflfffffffhffs",
    "fffffffffffffffs",
    "fhffffffffllfffs",
    "fffffffffffffffs",
    "ffffffffhffffffs",
    "fflffffffhlffffs",
    "fffffffffffffffs",
    "fffffhffffffflfs",
    "fffffffffffffffs",
    "flffffffffhffffs",
    "fffffffffffffffs",
    "ffffffhlfffffffs",
    "fffffffffffflffs",
    "fhfffffffffffffs",
    "ssssssssssssssss",
  ],
  [
    "fffffffffffffffs",
    "ffhfffffflfffffs",
    "fffffffffffffffs",
    "fffffflfffffhffs",
    "fffffffffffffffs",
    "flfffffffffffffs",
    "ffffffffffhffffs",
    "fffffhlffffffffs",
    "fffffffffffffffs",
    "fffffffffffflffs",
    "ffhffffffffffffs",
    "fffffffffffffffs",
    "fffffffflffffffs",
    "fhfffffffffhfffs",
    "fffffflffffffffs",
    "ssssssssssssssss",
  ],
  [
    "fffffffffffffffs",
    "fffffffffffffffs",
    "fffhhffffffflffs",
    "ffhllffffffffffs",
    "fffllffffffffffs",
    "fffffffffffffffs",
    "fffffffffhfffffs",
    "fffffffffffffffs",
    "flfffffffffffffs",
    "fffffffffffhfffs",
    "fffffhfffffffffs",
    "fffffffffffffffs",
    "fffffffffffffffs",
    "ffffffffflfffffs",
    "fffhfffffffffffs",
    "ssssssssssssssss",
  ],
];

const WALL_ART: PixelRows = [
  "hhhhhhsmhhhhhhsm",
  "hsssssdmhsssssdm",
  "hsssmsdmhsssssdm",
  "hssmssdmhsssssdm",
  "hsssssdmhssmssdm",
  "hsssssdmhsssmsdm",
  "sddddddmsddddddm",
  "mmmmmmmmmmmmmmmm",
  "hhsmhhhhhhsmhhhh",
  "ssdmhsssssdmhsss",
  "ssdmhsssssdmhsss",
  "ssdmhssmmsdmhsss",
  "smdmhsssssdmhsss",
  "ssdmhsssssdmhsss",
  "dddmsddddddmsddd",
  "mmmmmmmmmmmmmmmm",
];

const GOLD_ART: PixelRows = [
  "................",
  "................",
  "...........w....",
  "..........wyw...",
  "......oooo.w....",
  "....ooyyyyoo....",
  "...oyyyggggbo...",
  "...oyggggggbo...",
  "..oyggggggbbbo..",
  "..ogggggbbbbbo..",
  "..oggbbbbbbboo..",
  "...oobbbbbooo...",
  ".....ooooo..oo..",
  "...........oybo.",
  "............oo..",
  "................",
];

const DUG_ART: PixelRows = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......pp.p......",
  ".....pppppp.....",
  "....lpppppp.....",
  ".....pppppl.....",
  "......l.pp......",
  "................",
  "................",
  "................",
  "................",
  "................",
];

export const ROBOT_ART: PixelRows = [
  "....B.B..B.B....",
  ".....B.BB.B.....",
  ".....kkLLkk.....",
  "..kk.keeaak.kk..",
  "..tt.kvvvvk.tt..",
  "..rrkkvvvvkkrr..",
  "..ttkekkkkaktt..",
  "..rrkeeaaaakrr..",
  "..ttkeaaaaaktt..",
  "..rrkeakkaakrr..",
  "..ttkaaaaaaktt..",
  "..rrkaaaaddkrr..",
  "..ttkaaadddktt..",
  "..rrkddddddkrr..",
  "..ttkkkkkkkktt..",
  "..kk........kk..",
];

const FRINGE_NORTH: PixelRows = [
  "x.x.x.x.x.x.x.x.",
  "...x...x...x...x",
  ".x.......x......",
  ...Array.from({ length: 13 }, () => "................"),
];

const SHROUD_ART: PixelRows = Array.from({ length: TILE_SIZE }, (_, y) =>
  y % 2 === 0 ? "x.x.x.x.x.x.x.x." : ".x.x.x.x.x.x.x.x",
);

const SPARKLE_ART: PixelRows = [
  "................",
  "........w.......",
  "...w....y....w..",
  "....y.......y...",
  "................",
  "................",
  "................",
  ".wy..........yw.",
  "................",
  "................",
  "................",
  "................",
  "....y.......y...",
  "...w....y....w..",
  "........w.......",
  "................",
];

function swapHalves(rows: PixelRows): string[] {
  const half = rows.length / 2;
  return [...rows.slice(half), ...rows.slice(0, half)];
}

export type FringeSide = "north" | "east" | "south" | "west";

export const FRINGE_SIDES: readonly FringeSide[] = ["north", "east", "south", "west"];

const SIDE_TURNS: Record<FringeSide, number> = { north: 0, east: 1, south: 2, west: 3 };

function fringeSprite(side: FringeSide): Sprite {
  return sprite(rotateTimes(FRINGE_NORTH, SIDE_TURNS[side]), { x: "fog-edge" });
}

export const TILE_SPRITES = {
  floor: FLOOR_ART.map((rows) => sprite(rows, FLOOR_TONES)),
  wall: [WALL_ART, swapHalves(WALL_ART)].map((rows) => sprite(rows, WALL_TONES)),
  gold: sprite(GOLD_ART, ORE_TONES),
  dug: sprite(DUG_ART, { p: "dug", l: "floor-lo" }),
  robot: sprite(ROBOT_ART, ROBOT_TONES),
  shroud: sprite(SHROUD_ART, { x: "void" }),
  sparkle: sprite(SPARKLE_ART, { w: "glint", y: "ore-hi" }),
  fringe: {
    north: fringeSprite("north"),
    east: fringeSprite("east"),
    south: fringeSprite("south"),
    west: fringeSprite("west"),
  } satisfies Record<FringeSide, Sprite>,
};

export const SPRITE_ID = {
  floor: (variant: number) => `ms-floor-${variant}`,
  wall: (variant: number) => `ms-wall-${variant}`,
  gold: "ms-gold",
  dug: "ms-dug",
  robot: "ms-robot",
  shroud: "ms-shroud",
  sparkle: "ms-sparkle",
  fringe: (side: FringeSide) => `ms-fringe-${side}`,
} as const;

export function tileVariant(row: number, col: number, count: number): number {
  const hash = (row * 73856093) ^ (col * 19349663);
  return Math.abs(hash) % count;
}
