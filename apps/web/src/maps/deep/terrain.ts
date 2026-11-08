import { glyphRows, toSignCase } from "../../pixel/aknajel.ts";
import {
  AMETHYST,
  CLAY,
  CORE,
  EMERALD,
  IRON,
  isMolten,
  LIMESTONE,
  OBSIDIAN,
  STRATUM_COUNT,
  stratumTone,
} from "./palette.ts";
import {
  type CrystalKind,
  dither,
  hash,
  LAVA,
  noise,
  OPEN,
  ROCK,
  SKY,
  scaled,
  TIMBER,
  type Vein,
  WATER,
  type World,
} from "./world.ts";

function stratumIndex(strata: readonly number[], d: number): number {
  for (let k = 0; k < strata.length; k += 1) if (d < (strata[k] ?? 0)) return k;
  return strata.length - 1;
}

export function stratumAt(world: World, x: number, y: number): number {
  return stratumIndex(world.strata, y - world.groundY + (world.shift[x] ?? 0));
}

function surfaceAt(groundY: number, x: number): number {
  return groundY + Math.round(Math.sin(x * 0.045) * 1.5 + Math.sin(x * 0.13 + 2) * 0.8);
}

export function paintSky(world: World, groundY: number, rand: () => number, moonX: number): void {
  const { W, put } = world;
  world.groundY = groundY;
  for (let y = 0; y < Math.min(world.H, groundY + 4); y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = y / groundY + (dither(x, y) - 0.5) * 0.28;
      put(x, y, t < 0.35 ? "sky-0" : t < 0.7 ? "sky-1" : "sky-2");
      world.mask[y * W + x] = SKY;
    }
  }
  for (let x = 0; x < W; x += 1) {
    const hill =
      groundY - 3 - Math.round(4 + Math.sin(x * 0.021 + 1) * 4 + Math.sin(x * 0.07) * 1.6);
    for (let y = Math.max(0, hill); y < groundY + 4; y += 1) put(x, y, "hill");
    if (hash(x, 3) > 0.93) {
      const h = 3 + Math.floor(hash(x, 4) * 5);
      for (let k = 0; k < h; k += 1) put(x, hill - k, "tree");
      put(x - 1, hill - h + 2, "tree");
      put(x + 1, hill - h + 1, "tree");
    }
  }
  const my = Math.max(6, Math.round(groundY * 0.32));
  for (let y = -7; y <= 7; y += 1) {
    for (let x = -7; x <= 7; x += 1) {
      const isDisc = x * x + y * y <= 45;
      const isBite = (x + 3) * (x + 3) + (y - 2) * (y - 2) <= 34;
      if (isDisc && !isBite) put(moonX + x, my + y, x + y < -4 ? "moon-hi" : "moon");
    }
  }
  for (let i = 0; i < Math.round(W * 0.2); i += 1) {
    world.stars.push({
      x: Math.floor(rand() * W),
      y: Math.floor(rand() * Math.max(1, groundY - 12)),
      phase: rand() * 6,
      bright: rand(),
    });
  }
}

function pebbles(world: World, groundY: number, rand: () => number): void {
  const { W, H, put } = world;
  for (let i = 0; i < Math.round((W * H) / 900); i += 1) {
    const x = Math.floor(rand() * W);
    const y = groundY + 6 + Math.floor(rand() * Math.max(1, H - groundY - 6));
    const r = 1 + rand() * 1.8;
    const k = stratumAt(world, x, y);
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        if ((dx * dx) / (r * r * 1.6) + (dy * dy) / (r * r) <= 1) {
          put(x + dx, y + dy, dy < 0 ? stratumTone(k, "stratum", 2) : stratumTone(k, "stratum", 0));
        }
      }
    }
    put(x - 1, y - 1, stratumTone(Math.min(STRATUM_COUNT - 1, k + 1), "stratum", 2));
  }
}

function roots(world: World, groundY: number, rand: () => number): void {
  for (let i = 0; i < Math.round(world.W / 7); i += 1) {
    let x = Math.floor(rand() * world.W);
    let y = groundY + 1;
    const len = 6 + Math.floor(rand() * 16);
    for (let k = 0; k < len; k += 1) {
      world.put(x, y, k < 4 ? "root" : "root-lo");
      y += 1;
      if (rand() < 0.35) x += rand() < 0.5 ? -1 : 1;
      if (rand() < 0.12) world.put(x + (rand() < 0.5 ? -1 : 1), y, "root");
    }
  }
}

const FOSSIL_ART = [".ff.", "f..f", "f.ff", ".f.."];

function crack(world: World, x: number, y: number, rand: () => number, length: number): void {
  let cx = x;
  let cy = y;
  for (let k = 0; k < length; k += 1) {
    if (world.maskAt(cx, cy) !== ROCK) return;
    world.put(cx, cy, k === 0 || rand() < 0.2 ? "lava-top" : rand() < 0.5 ? "lava" : "lava-mid");
    world.mask[cy * world.W + cx] = LAVA;
    cx += rand() < 0.5 ? 1 : -1;
    cy += rand() < 0.6 ? 1 : 0;
  }
}

function fleck(world: World, x: number, y: number, k: number, rand: () => number): void {
  if (k === LIMESTONE) {
    if (rand() < 0.04) world.rows(FOSSIL_ART, { f: "fossil" }, x, y);
    else world.put(x, y, "quartz");
  } else if (k === AMETHYST) {
    world.put(x, y, "amethyst-lo");
    if (rand() < 0.45) world.put(x, y - 1, "amethyst");
  } else if (k === IRON) {
    world.put(x, y, rand() < 0.3 ? "hematite" : "rust");
    if (rand() < 0.3) world.put(x + 1, y, "rust-lo");
  } else if (k === EMERALD) {
    world.put(x, y, "emerald-lo");
    if (rand() < 0.35) world.put(x, y - 1, "emerald");
  } else if (k === OBSIDIAN) {
    world.put(x, y, "glass");
  }
}

function flecks(world: World, groundY: number, rand: () => number): void {
  const { W, H } = world;
  for (let i = 0; i < Math.round((W * H) / 380); i += 1) {
    const x = Math.floor(rand() * W);
    const y = groundY + 30 + Math.floor(rand() * Math.max(1, H - groundY - 30));
    fleck(world, x, y, stratumAt(world, x, y), rand);
  }
}

export function moltenCracks(world: World, rand: () => number): void {
  const { W, H } = world;
  for (let i = 0; i < Math.round((W * H) / 900); i += 1) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const k = stratumAt(world, x, y);
    if (!isMolten(k) || (k === OBSIDIAN && rand() < 0.6)) continue;
    crack(world, x, y, rand, 3 + Math.floor(rand() * (k === CORE ? 8 : 5)));
  }
}

const TILE = 128;
const TILE_MASK = TILE - 1;
let rockTile: Uint8Array | null = null;
let cavityTile: Uint8Array | null = null;

function tiles(): { rock: Uint8Array; cavity: Uint8Array } {
  if (!rockTile || !cavityTile) {
    rockTile = new Uint8Array(TILE * TILE);
    cavityTile = new Uint8Array(TILE * TILE);
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const v = noise(x, y, 5) * 0.6 + noise(x, y, 2) * 0.4 + (dither(x, y) - 0.5) * 0.25;
        rockTile[y * TILE + x] = v < 0.4 ? 0 : v < 0.62 ? 1 : 2;
        const c = noise(x + 300, y, 3) + (dither(x, y) - 0.5) * 0.3;
        cavityTile[y * TILE + x] = c < 0.45 ? 0 : c < 0.7 ? 1 : 2;
      }
    }
  }
  return { rock: rockTile, cavity: cavityTile };
}

function strataTones(world: World, kind: "stratum" | "cavity") {
  return Array.from({ length: STRATUM_COUNT }, (_, k) =>
    [0, 1, 2].map((v) => world.rgb(stratumTone(k, kind, v))),
  );
}

function fill(
  world: World,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  kind: "stratum" | "cavity",
  maskValue: number,
  test?: (x: number, y: number) => boolean,
): void {
  const { W, H, data, mask, shift, groundY } = world;
  const tile = kind === "stratum" ? tiles().rock : tiles().cavity;
  const tones = strataTones(world, kind);
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(H, Math.ceil(y1));
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(W, Math.ceil(x1));
  for (let y = ya; y < yb; y += 1) {
    const depth = y - groundY;
    for (let x = xa; x < xb; x += 1) {
      if (test && !test(x, y)) continue;
      const k = stratumIndex(world.strata, depth + (shift[x] ?? 0));
      const tone =
        tones[k]?.[tile[((y + k * 37) & TILE_MASK) * TILE + ((x + k * 53) & TILE_MASK)] ?? 0];
      if (!tone) continue;
      const i = (y * W + x) * 4;
      data[i] = tone[0];
      data[i + 1] = tone[1];
      data[i + 2] = tone[2];
      data[i + 3] = 255;
      mask[y * W + x] = maskValue;
    }
  }
}

export function paintRock(world: World, groundY: number, rand: () => number): void {
  const { W, H, put } = world;
  for (let x = 0; x < W; x += 1) world.shift[x] = Math.sin(x * 0.045) * 4 + noise(x, 7, 23) * 9;
  const surface = Array.from({ length: W }, (_, x) => surfaceAt(groundY, x));
  fill(world, 0, groundY - 2, W, H, "stratum", ROCK, (x, y) => y >= (surface[x] ?? groundY));
  for (let x = 0; x < W; x += 1) {
    const s = surface[x] ?? groundY;
    put(x, s, "grass");
    if (hash(x, 7) > 0.62) put(x, s - 1, "grass-lo");
    if (hash(x, 9) > 0.9) put(x, s - 2, "grass-dk");
  }
  pebbles(world, groundY, rand);
  roots(world, groundY, rand);
  flecks(world, groundY, rand);
}

export function carve(
  world: World,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  test?: (x: number, y: number) => boolean,
): void {
  fill(world, x0, y0, x1, y1, "cavity", OPEN, test);
}

export function carveTunnel(
  world: World,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
): void {
  carve(world, x0, y0, x1, y1, (x, y) => y >= y0 + Math.floor(noise(x + seed, 1, 6) * 3));
}

export function edges(world: World, y0: number, y1: number): void {
  const { W, mask, put, pixel } = world;
  for (let y = Math.max(1, y0); y < Math.min(world.H - 1, y1); y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      const m = mask[y * W + x];
      const up = mask[(y - 1) * W + x];
      const down = mask[(y + 1) * W + x];
      if (m === OPEN && up === ROCK) {
        put(x, y, "shade");
        if (hash(x, y) > 0.55) put(x, y + 1, scaled(pixel(x, y + 1), 0.6));
      } else if (m === ROCK && down === OPEN) {
        put(x, y, scaled(pixel(x, y), 0.7));
      } else if (m === ROCK && up === OPEN) {
        put(x, y, scaled(pixel(x, y), 1.28));
      } else if (m === ROCK && (mask[y * W + x - 1] === OPEN || mask[y * W + x + 1] === OPEN)) {
        put(x, y, scaled(pixel(x, y), 0.82));
      }
    }
  }
}

export function wood(
  world: World,
  x: number,
  y: number,
  w: number,
  h: number,
  isVertical: boolean,
): void {
  const { rect, put } = world;
  rect(x, y, w, h, "wood");
  for (let i = 0; i < (isVertical ? h : w); i += 1) {
    const g = hash(x + (isVertical ? 0 : i), y + (isVertical ? i : 0));
    if (g <= 0.8) continue;
    if (isVertical) put(x + 1 + (Math.floor(g * 10) % Math.max(1, w - 2)), y + i, "wood-grain");
    else put(x + i, y + 1 + (Math.floor(g * 10) % Math.max(1, h - 2)), "wood-grain");
  }
  rect(x, y, isVertical ? 1 : w, isVertical ? h : 1, "wood-hi");
  rect(
    isVertical ? x + w - 1 : x,
    isVertical ? y : y + h - 1,
    isVertical ? 1 : w,
    isVertical ? h : 1,
    "wood-lo",
  );
  world.setMask(x, y, w, h, TIMBER);
}

export function rails(world: World, x0: number, x1: number, y: number): void {
  const { rect, put } = world;
  rect(x0, y + 1, x1 - x0, 3, "ballast");
  for (let x = x0; x < x1; x += 1) if (hash(x, y) > 0.6) put(x, y + 2, "ballast-hi");
  for (let x = x0 + 1; x < x1 - 3; x += 6) rect(x, y + 1, 4, 1, "sleeper");
  rect(x0, y, x1 - x0, 1, "rail");
  for (let x = x0; x < x1; x += 2) put(x, y, "rail-hi");
}

const VEIN_SHAPE: readonly [number, number, string][] = [
  [0, 0, "ore"],
  [1, 0, "ore-lo"],
  [0, 1, "ore-lo"],
  [-1, 0, "ore-hi"],
  [0, -1, "ore-hi"],
];

export function vein(
  world: World,
  cx: number,
  cy: number,
  count: number,
  rand: () => number,
  spread = 3,
): Vein {
  const cells: [number, number][] = [];
  for (let i = 0; i < count * 3 && cells.length < count; i += 1) {
    const x = Math.round(cx + (rand() - 0.5) * spread * 2);
    const y = Math.round(cy + (rand() - 0.5) * spread * 2);
    if (world.maskAt(x, y) !== ROCK) continue;
    for (const [dx, dy, tone] of VEIN_SHAPE) {
      if (world.maskAt(x + dx, y + dy) === ROCK) world.put(x + dx, y + dy, tone);
    }
    if (world.maskAt(x + 1, y + 1) === ROCK) world.put(x + 1, y + 1, "ore-edge");
    cells.push([x, y]);
  }
  const v: Vein = { cx, cy, cells, isMined: false, phase: rand() * 5 };
  world.veins.push(v);
  return v;
}

export function mineVein(world: World, v: Vein): void {
  v.isMined = true;
  for (const [x, y] of v.cells) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (world.maskAt(x + dx, y + dy) !== ROCK) continue;
        world.put(x + dx, y + dy, (dx + dy) % 2 ? "mined" : "mined-hi");
      }
    }
  }
}

function signRows(text: string): string[] {
  const chars = [...toSignCase(text)];
  const rows = Array.from({ length: 7 }, () => "");
  chars.forEach((char, index) => {
    const glyph = char === " " ? null : glyphRows(char);
    const gap = index < chars.length - 1 ? "." : "";
    for (let r = 0; r < 7; r += 1) rows[r] += (glyph ? (glyph[r + 3] ?? ".....") : "..") + gap;
  });
  return rows;
}

export function sign(world: World, text: string, x: number, y: number, ink: string): number {
  const art = signRows(text);
  const w = art[0]?.length ?? 0;
  world.rect(x - 3, y - 2, w + 6, art.length + 4, "wood-lo");
  world.rect(x - 2, y - 1, w + 4, art.length + 2, "plank");
  world.rows(art, { "#": "plank-ink" }, x + 1, y + 1);
  world.rows(art, { "#": ink }, x, y);
  world.setMask(x - 3, y - 2, w + 6, art.length + 4, TIMBER);
  return w + 6;
}

const CRYSTAL_TONES: Record<CrystalKind, { body: string; hi: string; lo: string }> = {
  gem: { body: "gem", hi: "gem-hi", lo: "gem-lo" },
  amethyst: { body: "amethyst", hi: "amethyst-hi", lo: "amethyst-lo" },
  emerald: { body: "emerald", hi: "emerald-hi", lo: "emerald-lo" },
};

export function crystalKindAt(k: number): CrystalKind | null {
  if (k === AMETHYST) return "amethyst";
  if (k === EMERALD) return "emerald";
  return null;
}

export function crystal(
  world: World,
  x: number,
  y: number,
  rand: () => number,
  isUp: boolean,
  kind: CrystalKind = "gem",
): void {
  const tones = CRYSTAL_TONES[kind];
  const h = 3 + Math.floor(rand() * (kind === "amethyst" ? 6 : 4));
  for (let k = 0; k < h; k += 1) {
    const yy = isUp ? y - k : y + k;
    world.put(x, yy, k === h - 1 ? tones.hi : tones.body);
    if (k < h - 2) world.put(x + 1, yy, tones.lo);
  }
  if (rand() < 0.7) {
    world.put(x - 1, isUp ? y - 1 : y + 1, tones.body);
    world.put(x - 1, isUp ? y - 2 : y + 2, tones.hi);
  }
  world.crystals.push({ x, y: isUp ? y - 2 : y + 2, phase: rand() * 6, kind });
}

export function stalactite(world: World, x: number, y: number, len: number): number {
  for (let k = 0; k < len; k += 1) {
    const w = Math.max(0, Math.floor((len - k) / 2.5));
    for (let dx = -w; dx <= w; dx += 1) {
      if (world.maskAt(x + dx, y + k) !== OPEN) continue;
      world.put(x + dx, y + k, dx === -w ? "rubble-hi" : dx === w ? "rubble-lo" : "rubble");
      world.mask[(y + k) * world.W + x + dx] = ROCK;
    }
  }
  return y + len;
}

export function ceilingAt(world: World, x: number, fromY: number): number {
  let y = fromY;
  while (y > 0 && world.maskAt(x, y - 1) === OPEN) y -= 1;
  return y;
}

const MUSHROOM_ART = [".ccc.", "cCCCc", "..s..", "..s.."];

type CaveOptions = { hasPool?: boolean; hasCrystals?: boolean };

type PoolKind = "water" | "lake" | "lava";

const POOL_TONES: Record<PoolKind, readonly [string, string, string, string]> = {
  water: ["water-top", "water", "water-mid", "water-deep"],
  lake: ["lake-top", "lake", "lake-mid", "lake-deep"],
  lava: ["lava-top", "lava", "lava-mid", "lava-deep"],
};

function poolKindAt(k: number): PoolKind {
  if (isMolten(k)) return "lava";
  return k === EMERALD ? "lake" : "water";
}

function pool(
  world: World,
  x0: number,
  x1: number,
  level: number,
  floorOf: (x: number) => number | null,
  kind: PoolKind,
): void {
  const [top, shallow, mid, deep] = POOL_TONES[kind];
  const maskValue = kind === "lava" ? LAVA : WATER;
  for (let x = x0; x <= x1; x += 1) {
    const f = floorOf(x);
    if (f === null || f < level) continue;
    for (let y = level; y <= f; y += 1) {
      if (world.maskAt(x, y) !== OPEN) continue;
      const v = dither(x, y);
      const tone =
        y === level ? top : y - level < 2 ? (v > 0.5 ? shallow : mid) : v > 0.6 ? mid : deep;
      world.put(x, y, tone);
      world.mask[y * world.W + x] = maskValue;
      if (y !== level) continue;
      if (kind === "lava") {
        world.lavas.push({ x, y });
        if (x % 6 === 0) world.glows.push({ x, y: y - 1, phase: hash(x, y) * 6, kind: "lava" });
      } else {
        world.puddles.push({ x, y });
      }
    }
  }
}

function rustStain(world: World, x: number, roof: number, rand: () => number): void {
  for (let k = 0; k < 3 + Math.floor(rand() * 5); k += 1) {
    const y = roof - 1 - k;
    if (world.maskAt(x, y) !== ROCK) return;
    world.put(x, y, k < 2 ? "rust-hi" : "rust");
  }
}

function moss(world: World, x: number, f: number, rand: () => number): void {
  for (let dx = -2; dx <= 2; dx += 1) {
    if (world.maskAt(x + dx, f + 1) !== ROCK || world.maskAt(x + dx, f) !== OPEN) continue;
    world.put(x + dx, f + 1, rand() < 0.4 ? "moss-hi" : "moss");
    if (rand() < 0.5) world.put(x + dx, f, "moss");
  }
  world.glows.push({ x, y: f, phase: rand() * 6, kind: "moss" });
}

export function cave(
  world: World,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rand: () => number,
  options: CaveOptions = {},
): void {
  const seed = rand() * 100;
  const isInside = (x: number, y: number) => {
    const n = (noise(x + seed, y, 5) - 0.5) * 0.7 + (noise(x, y + seed, 2) - 0.5) * 0.25;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + n;
  };
  carve(world, cx - rx * 1.4, cy - ry * 1.5, cx + rx * 1.4, cy + ry * 1.5, isInside);
  const x0 = Math.floor(cx - rx * 1.3);
  const x1 = Math.ceil(cx + rx * 1.3);
  const floorOf = (x: number) => {
    let y = Math.ceil(cy + ry * 1.5);
    while (y > cy && world.maskAt(x, y) !== OPEN) y -= 1;
    return y > cy ? y : null;
  };
  const roofOf = (x: number) => {
    let y = Math.floor(cy - ry * 1.5);
    while (y < cy && world.maskAt(x, y) !== OPEN) y += 1;
    return y < cy ? y : null;
  };
  const depth = stratumAt(world, Math.round(cx), Math.round(cy));
  const molten = isMolten(depth);
  if (options.hasPool ?? rand() < (molten ? 0.8 : 0.55))
    pool(world, x0, x1, Math.round(cy + ry * (0.25 + rand() * 0.3)), floorOf, poolKindAt(depth));
  for (let k = 0; k < 2 + Math.floor(rand() * 3); k += 1) {
    const x = Math.round(cx + (rand() - 0.5) * rx * 1.4);
    const r = roofOf(x);
    if (r === null) continue;
    if (depth === IRON) rustStain(world, x, r, rand);
    if (world.maskAt(x, r - 1) === ROCK && rand() < (molten ? 0.15 : 0.55)) {
      world.roosts.push({ x, y: r });
    } else if (depth >= LIMESTONE) {
      const tip = stalactite(world, x, r, 2 + Math.floor(rand() * 4));
      const f = floorOf(x);
      if (!molten && f !== null && f > tip + 3) world.drips.push({ x, top: tip - 1, floor: f });
    }
  }
  const kind = options.hasCrystals ? "gem" : crystalKindAt(depth);
  if (kind) {
    const count = kind === "amethyst" ? 4 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 2);
    for (let k = 0; k < count; k += 1) {
      const x = Math.round(cx + (rand() - 0.5) * rx * 1.6);
      const r = roofOf(x);
      if (r !== null && rand() < 0.5) crystal(world, x, r, rand, false, kind);
      const f = floorOf(x);
      if (f !== null && world.maskAt(x, f + 1) === ROCK && world.maskAt(x, f) === OPEN)
        crystal(world, x, f, rand, true, kind);
    }
  }
  if (depth === LIMESTONE || depth === EMERALD || depth === AMETHYST) {
    for (let k = 0; k < 6; k += 1) {
      const x = Math.round(cx + (rand() - 0.5) * rx * 1.8);
      const r = roofOf(x);
      if (r !== null) world.glows.push({ x, y: r, phase: rand() * 6, kind: "worm" });
    }
  }
  if (depth === EMERALD) {
    for (let k = 0; k < 4; k += 1) {
      const x = Math.round(cx + (rand() - 0.5) * rx * 1.6);
      const f = floorOf(x);
      if (f !== null) moss(world, x, f, rand);
    }
    return;
  }
  if (depth >= CLAY && !molten && rand() < 0.7) {
    for (let k = 0; k < 2; k += 1) {
      const x = Math.round(cx + (rand() - 0.5) * rx * 1.4);
      const f = floorOf(x);
      if (f === null || world.maskAt(x, f + 1) !== ROCK) continue;
      world.rows(MUSHROOM_ART, { c: "gem-lo", C: "gem", s: "rubble-hi" }, x - 2, f - 3);
      world.glows.push({ x, y: f - 3, phase: rand() * 6, kind: "mushroom" });
    }
  }
}
