import { type PixelRows, rotateTimes, type Sprite, sprite, TRANSPARENT } from "./pixel-art.ts";

export const TILE_SIZE = 16;

export const FLOOR_TONES = { f: "floor", l: "floor-lo", h: "floor-hi", s: "seam" } as const;
export const WALL_TONES = { h: "wall-hi", s: "wall", d: "wall-lo", m: "mortar" } as const;
export const ORE_TONES = {
  o: "ore-edge",
  g: "ore",
  y: "ore-hi",
  b: "ore-lo",
  w: "glint",
} as const;
export const ROBOT_TONES = {
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

export const FLOOR_ART: readonly PixelRows[] = [
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

export const WALL_ART: PixelRows = [
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

export const GOLD_ART: PixelRows = [
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

export const DUG_ART: PixelRows = [
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

const EMPTY_ROW = "................";

function canvas(rows: Readonly<Record<number, string>>): string[] {
  return Array.from({ length: TILE_SIZE }, (_, y) => rows[y] ?? EMPTY_ROW);
}

export const BURST_ART: readonly PixelRows[] = [
  canvas({
    5: ".......ww.......",
    6: ".......yy.......",
    7: ".....wy..yw.....",
    8: ".....wy..yw.....",
    9: ".......yy.......",
    10: ".......ww.......",
  }),
  canvas({
    2: ".......ww.......",
    4: "....y......y....",
    7: "..w..........w..",
    8: "..y..........y..",
    11: "....y......y....",
    13: ".......ww.......",
  }),
  canvas({
    0: "...w........w...",
    3: "y..............y",
    7: "w...............",
    9: "...............w",
    12: "y..............y",
    15: "...w........w...",
  }),
];

const CONE_ART: PixelRows = [
  "..B.....B.....B.",
  "................",
  "B.....B.....B...",
  "................",
  "...B...B...B....",
  ".B...B...B...B..",
  "................",
  "..B..B..B..B..B.",
  "................",
  ".B.B..B.B..B.B..",
  "................",
  "..B.B.B.B.B.B...",
  "...B.B.B.B.B....",
  "....B.B.B.B.....",
  ".....B.B.B......",
  "......B.B.......",
];

export const SCAN_ART: PixelRows = canvas({
  0: "ssss........ssss",
  1: "s..............s",
  2: "s..............s",
  3: "s..............s",
  12: "s..............s",
  13: "s..............s",
  14: "s..............s",
  15: "ssss........ssss",
});

const CRACK_ART: PixelRows = canvas({
  2: "........v.......",
  3: ".......vv.......",
  4: ".......v........",
  5: "......vv.v......",
  6: ".....v..vv......",
  7: "....vv...v......",
  8: "....v....vv.....",
  9: "...v......v.....",
  10: "..vv.......v....",
  11: "..v.........v...",
});

const IMPACT_ART: PixelRows = canvas({
  3: ".......a........",
  4: "...a...a...a....",
  5: "....a..g..a.....",
  6: ".....agwga......",
  7: ".aaaagwwwgaaaa..",
  8: ".....agwga......",
  9: "....a..g..a.....",
  10: "...a...a...a....",
  11: ".......a........",
});

const DUST_ART: PixelRows = canvas({
  9: "...h..f...h.....",
  10: ".f..hh.ff..f..h.",
  11: "..hffhhffhh.f...",
  12: ".fhhffhhffhfh...",
  13: "..ffhhffhhff....",
});

const ALERT_ART: PixelRows = canvas({
  0: "..........iiiiii",
  1: "..........iaaaai",
  2: "..........iaiiai",
  3: "..........iaiiai",
  4: "..........iaiiai",
  5: "..........iaaaai",
  6: "..........iaiiai",
  7: "..........iaaaai",
  8: "..........iiiiii",
});

const RUBBLE_ART: PixelRows = canvas({
  5: "......hs........",
  6: "....hhssd.......",
  7: "...hsssdd.hs....",
  8: "..hssddmhhssd...",
  9: ".hssdmhhssssdd..",
  10: "hssddhsssdddhsd.",
  11: "hsddhssdddmhssdd",
  12: "sdmhsssddhsssddd",
  13: "ddhsssddhssdddmd",
  14: "dmmdhssdmmhsddmm",
  15: "mmmmmmmmmmmmmmmm",
});

export const NUGGET_ART: PixelRows = [
  "................",
  "................",
  "................",
  "................",
  ".......oooo.....",
  ".....ooyyyyoo...",
  "....oyyggggbo...",
  "....oggggggbo...",
  "...oggggbbbbbo..",
  "...oggbbbbbboo..",
  "....oobbbbooo...",
  "......ooooo.....",
  "................",
  "................",
  "................",
  "................",
];

const CART_BODY: PixelRows = [
  "........................",
  "........................",
  "........................",
  "........................",
  "kkkkkkkkkkkkkkkkkkkkkkkk",
  "keeeeeeeeeeeeeeeeeeeeeek",
  ".kaaaaaaaaaaaaaaaaaaaak.",
  ".kaddaaaaaddaaaaaddaaak.",
  ".kaddaaaaaddaaaaaddaaak.",
  "..kaaaaaaaaaaaaaaaaaak..",
  "..kddddddddddddddddddk..",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "....kttk........kttk....",
  "...ktrrtk......ktrrtk...",
  "...ktrrtk......ktrrtk...",
  "....kkkk........kkkk....",
];

const CART_EMPTY_ROW = "........................";

function cartRows(rows: Readonly<Record<number, string>>): string[] {
  return Array.from({ length: CART_BODY.length }, (_, y) => rows[y] ?? CART_EMPTY_ROW);
}

const CART_FILLS: readonly PixelRows[] = [
  cartRows({ 2: "....ooo.................", 3: "...oyggo................" }),
  cartRows({ 2: "...............ooo......", 3: "..............oggbo....." }),
  cartRows({
    1: ".........oooo...........",
    2: "........oyyggo..........",
    3: ".......oggggbbo.........",
  }),
  cartRows({
    0: "..........w.............",
    1: "...ooo...owo.....ooo....",
    2: "..oyggo.oyggo...oyggo...",
    3: ".oggggbogggbbo.oggbbbo..",
  }),
];

function overlay(base: PixelRows, top: PixelRows): string[] {
  return base.map((row, y) =>
    [...row]
      .map((char, x) => {
        const over = top[y]?.[x] ?? TRANSPARENT;
        return over === TRANSPARENT ? char : over;
      })
      .join(""),
  );
}

const CART_TONES = { ...ROBOT_TONES, ...ORE_TONES } as const;

export const CART_LEVELS = 4;

function cartLevel(level: number): Sprite {
  const fills = CART_FILLS.slice(0, level).reduce<PixelRows>(
    (rows, fill) => overlay(rows, fill),
    cartRows({}),
  );
  return sprite(overlay(fills, CART_BODY), CART_TONES);
}

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

const SPARK_TONES = { w: "glint", y: "ore-hi" } as const;

export const TILE_SPRITES = {
  floor: FLOOR_ART.map((rows) => sprite(rows, FLOOR_TONES)),
  wall: [WALL_ART, swapHalves(WALL_ART)].map((rows) => sprite(rows, WALL_TONES)),
  gold: sprite(GOLD_ART, ORE_TONES),
  dug: sprite(DUG_ART, { p: "dug", l: "floor-lo" }),
  robot: sprite(ROBOT_ART, ROBOT_TONES),
  shroud: sprite(SHROUD_ART, { x: "void" }),
  burst: BURST_ART.map((rows) => sprite(rows, SPARK_TONES)),
  cone: sprite(CONE_ART, { B: "beam" }),
  scan: sprite(SCAN_ART, { s: "scan" }),
  crack: sprite(CRACK_ART, { v: "void" }),
  impact: sprite(IMPACT_ART, { a: "alert", g: "ore-hi", w: "glint" }),
  dust: sprite(DUST_ART, { h: "wall-hi", f: "floor-hi" }),
  alert: sprite(ALERT_ART, { i: "alert-ink", a: "alert" }),
  rubble: sprite(RUBBLE_ART, WALL_TONES),
  nugget: sprite(NUGGET_ART, ORE_TONES),
  cart: Array.from({ length: CART_LEVELS + 1 }, (_, level) => cartLevel(level)),
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
  burst: (frame: number) => `ms-burst-${frame}`,
  cone: "ms-cone",
  scan: "ms-scan",
  crack: "ms-crack",
  impact: "ms-impact",
  dust: "ms-dust",
  alert: "ms-alert",
  fringe: (side: FringeSide) => `ms-fringe-${side}`,
} as const;

export function tileVariant(row: number, col: number, count: number): number {
  const hash = (row * 73856093) ^ (col * 19349663);
  return Math.abs(hash) % count;
}
