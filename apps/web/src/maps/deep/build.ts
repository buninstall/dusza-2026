import { billboard } from "./billboard.ts";
import type { LanternState } from "./sprites.ts";
import {
  carve,
  carveTunnel,
  cave,
  ceilingAt,
  crystal,
  edges,
  paintRock,
  paintSky,
  rails,
  sign,
  stalactite,
  stratumAt,
  vein,
  wood,
} from "./terrain.ts";
import {
  type Box,
  createWorld,
  dither,
  hash,
  NICHE,
  noise,
  OPEN,
  type Point,
  ROCK,
  seeded,
  type Vein,
  type World,
} from "./world.ts";

export const SHAFT_W = 16;
const GROUND_BELOW_SIGN = 14;

export type LevelInput = {
  box: Box;
  pit: Box | null;
  stars: number;
  isDaily: boolean;
  index: number;
  id: number;
};

export type LayoutInput = {
  W: number;
  H: number;
  isNarrow: boolean;
  plate: Box;
  front: Box;
  levels: readonly LevelInput[];
  palette: Readonly<Record<string, string>>;
  digId: number | null;
};

export type Cart = { x: number; y: number; fill: number };

export type Level = LevelInput & {
  y0: number;
  y1: number;
  rail: number;
  x0: number;
  x1: number;
  stopX: number;
  room: { x0: number; x1: number } | null;
  state: LanternState;
  veins: Vein[];
  cart: Cart | null;
  isFront: boolean;
  isDigging: boolean;
};

export type Lantern = {
  x: number;
  y: number;
  state: LanternState;
  seed: number;
  level: Level;
  isSmall: boolean;
};

export type Dig = {
  level: Level;
  shaftTop: number;
  reveal: (x0: number, y0: number, x1: number, y1: number) => void;
};

export type Mine = {
  world: World;
  groundY: number;
  shaftX: number;
  bottomY: number;
  levels: Level[];
  front: Level;
  lanterns: Lantern[];
  carts: Cart[];
  wheel: Point;
  beacon: Point;
  house: Point | null;
  dig: Dig | null;
  signLamp: Point;
};

function lanternState(level: LevelInput, isFront: boolean): LanternState {
  if (isFront || level.isDaily || level.stars >= 3) return "on";
  return level.stars < 0 ? "off" : "dim";
}

function headframe(
  world: World,
  shaftX: number,
  groundY: number,
): { wheel: Point; beacon: Point; house: Point | null } {
  const base = groundY;
  const topY = Math.max(24, groundY - 50);
  const lx = shaftX - 9;
  const rx = shaftX + SHAFT_W + 8;
  const cx = shaftX + SHAFT_W / 2;
  world.line(lx, base, Math.round(cx - 3), topY + 4, "truss");
  world.line(lx + 1, base, Math.round(cx - 2), topY + 4, "truss-lo");
  world.line(rx, base, Math.round(cx + 3), topY + 4, "truss");
  world.line(rx - 1, base, Math.round(cx + 2), topY + 4, "truss-lo");
  for (let i = 1; i < 5; i += 1) {
    const t0 = i / 5;
    const t1 = Math.min(1, (i + 1) / 5);
    const ya = Math.round(base + (topY + 4 - base) * t0);
    const yb = Math.round(base + (topY + 4 - base) * t1);
    const xa = Math.round(lx + (cx - 3 - lx) * t0);
    const xb = Math.round(rx + (cx + 3 - rx) * t0);
    world.line(xa, ya, xb, ya, "truss-lo");
    world.line(xa, ya, Math.round(rx + (cx + 3 - rx) * t1), yb, "truss-dk");
    world.line(xb, ya, Math.round(lx + (cx - 3 - lx) * t1), yb, "truss-dk");
  }
  world.rect(Math.round(cx) - 8, topY + 3, 17, 2, "truss");
  world.rect(Math.round(cx) - 1, topY - 4, 2, 4, "truss-lo");
  const hx = lx - 44;
  const hy = base - 16;
  let house: Point | null = null;
  if (hx > 2) {
    world.rect(hx, hy, 36, 16, "house");
    for (let i = 0; i < 6; i += 1)
      world.line(hx - 2 + i, hy - 1 - i, hx + 38 - i, hy - 1 - i, i === 0 ? "roof" : "roof-lo");
    world.rect(hx + 4, hy - 13, 4, 7, "roof-lo");
    world.rect(hx + 6, hy + 4, 5, 4, "window");
    world.rect(hx + 16, hy + 4, 5, 4, "window-lo");
    world.rect(hx + 8, hy + 4, 1, 4, "wood-grain");
    world.rect(hx + 6, hy + 6, 5, 1, "wood-grain");
    world.rect(hx + 27, hy + 6, 6, 10, "roof");
    world.line(hx + 36, hy + 3, lx + 2, topY + 10, "cable");
    house = { x: hx, y: hy };
  }
  return {
    wheel: { x: Math.round(cx), y: topY + 1 },
    beacon: { x: Math.round(cx), y: topY - 5 },
    house,
  };
}

function paintShaft(world: World, shaftX: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y += 1) {
    for (let x = shaftX; x < shaftX + SHAFT_W; x += 1) {
      const m = world.maskAt(x, y);
      if (m !== OPEN && m !== ROCK) continue;
      const v = noise(x, y, 3) + (dither(x, y) - 0.5) * 0.3;
      world.put(x, y, v < 0.5 ? "shaft" : "shaft-hi");
      world.mask[y * world.W + x] = OPEN;
    }
    if ((y - y0) % 10 === 0) {
      wood(world, shaftX - 2, y, 3, 3, false);
      wood(world, shaftX + SHAFT_W - 1, y, 3, 3, false);
    }
    if (world.maskAt(shaftX - 1, y) === ROCK) world.put(shaftX - 1, y, "wood-grain");
    if (world.maskAt(shaftX + SHAFT_W, y) === ROCK) world.put(shaftX + SHAFT_W, y, "wood-grain");
    if (y % 2 === 0) {
      world.put(shaftX + 1, y, "sleeper");
      world.put(shaftX + SHAFT_W - 2, y, "sleeper");
    }
  }
}

function carveNiche(world: World, b: Box, seed: number): void {
  const side = (y: number, k: number) => 1 + Math.floor(noise(seed + k, Math.floor(y / 2), 2) * 4);
  const lid = (x: number) => 1 + Math.floor(noise(Math.floor(x / 2), seed, 2) * 4);
  const sill = (x: number) => 1 + Math.floor(noise(Math.floor(x / 2), seed + 7, 2) * 2);
  carve(world, b.x - 5, b.y - 5, b.x + b.w + 5, b.y + b.h + 3, (x, y) => {
    return (
      x >= b.x - side(y, 0) &&
      x < b.x + b.w + side(y, 3) &&
      y >= b.y - lid(x) &&
      y < b.y + b.h + sill(x)
    );
  });
}

function carvePit(world: World, b: Box, seed: number): void {
  const jag = (v: number, k: number) => 1 + Math.floor(noise(Math.floor(v / 2), seed + k, 2) * 3);
  const inPit = (x: number, y: number) =>
    x >= b.x - jag(y, 0) &&
    x < b.x + b.w + jag(y, 2) &&
    y >= b.y - jag(x, 4) &&
    y < b.y + b.h + jag(x, 6);
  for (let y = b.y - 5; y < b.y + b.h + 5; y += 1) {
    for (let x = b.x - 5; x < b.x + b.w + 5; x += 1) {
      if (inPit(x, y)) {
        const deep = !inPit(x - 2, y - 2);
        world.put(x, y, deep ? "shade" : dither(x, y) > 0.5 ? "shaft" : "shaft-hi");
      } else if (inPit(x - 1, y - 1) || inPit(x, y - 1) || inPit(x - 1, y)) {
        world.put(x, y, "rubble-hi");
      } else if (inPit(x + 1, y + 1)) {
        world.put(x, y, "rubble-lo");
      }
    }
  }
}

function carveLevel(
  world: World,
  level: Level,
  seed: number,
  xEnd: number,
  isNarrow: boolean,
): void {
  carveTunnel(world, level.x0, level.y0, level.x1, level.y1, seed);
  const roomX = level.box.x + level.box.w + 6;
  level.room = !isNarrow && xEnd - roomX > 26 ? { x0: roomX, x1: xEnd } : null;
  const room = level.room;
  if (!room) return;
  const cx = (room.x0 + room.x1) / 2;
  const rx = (room.x1 - room.x0) / 2 + 4;
  const ry = 11 + hash(seed, 5) * 6;
  carve(world, room.x0 - 4, level.y0 - 20, room.x1, level.y1, (x, y) => {
    const n = noise(x, y, 4) * 3;
    return ((x - cx) / rx) ** 2 + ((y - level.y0) / (ry + n)) ** 2 <= 1 || y >= level.y0;
  });
}

function caves(
  world: World,
  mine: { shaftX: number; bottomY: number; groundY: number },
  all: Level[],
  rand: () => number,
): void {
  if (mine.shaftX > 34) {
    for (let y = mine.groundY + 40; y < mine.bottomY - 24; y += 96 + Math.floor(rand() * 40)) {
      const rx = Math.min((mine.shaftX - 14) / 2.6, 10 + rand() * 12);
      const cx = 6 + rx * 1.3 + rand() * Math.max(1, mine.shaftX - 16 - rx * 2.6);
      cave(world, cx, y, rx, 6 + rand() * 5, rand);
    }
  }
  all.forEach((level, i) => {
    const next = all[i + 1];
    if (!next || level.isFront) return;
    const top = level.y1 + 3;
    const gap = next.box.y - 8 - top;
    if (gap < 16 || rand() < 0.2 || level.isDigging || next.isDigging) return;
    const ry = Math.min(8, (gap - 4) / 3.4);
    const rx = 12 + rand() * 16;
    const cx = level.box.x + rx * 1.4 + rand() * Math.max(1, level.box.w - rx * 3);
    cave(world, cx, top + gap / 2, rx, ry, rand);
  });
}

function decorateRoom(
  world: World,
  level: Level,
  groundY: number,
  rand: () => number,
  lanterns: Lantern[],
): void {
  const room = level.room;
  if (!room) {
    const rx = level.x0 + 8 + Math.floor(rand() * 6);
    const ry = ceilingAt(world, rx, level.rail - 2);
    if (world.maskAt(rx, ry - 1) === ROCK && rx < level.box.x - 4)
      world.roosts.push({ x: rx, y: ry });
    return;
  }
  const depth = stratumAt(level.y0 - groundY, level.box.x, level.y0);
  const cx = Math.round((room.x0 + room.x1) / 2);
  if (!level.isDaily)
    sign(
      world,
      `-${String((level.index + 1) * 12).padStart(2, "0")} M`,
      room.x0 + 3,
      level.y0 + 2,
      "ink-gold",
    );
  lanterns.push({
    x: room.x1 - 9,
    y: level.y0 + 2,
    state: level.state,
    seed: rand() * 9,
    level,
    isSmall: false,
  });
  level.cart = {
    x: room.x0 + 4,
    y: level.rail - 9,
    fill: level.isDaily ? 3 : Math.max(0, level.stars),
  };
  for (let k = 0; k < 3; k += 1) {
    const rx = cx - 10 + Math.floor(rand() * 20);
    const ry = ceilingAt(world, rx, level.rail - 2);
    if (world.maskAt(rx, ry - 1) === ROCK) world.roosts.push({ x: rx, y: ry });
  }
  if (depth >= 2) {
    for (let k = 0; k < 2; k += 1) {
      const sx = cx - 8 + Math.floor(rand() * 16);
      const tip = stalactite(
        world,
        sx,
        ceilingAt(world, sx, level.rail - 2),
        3 + Math.floor(rand() * 4),
      );
      world.drips.push({ x: sx, top: tip - 1, floor: level.rail - 1 });
    }
  } else {
    world.drips.push({
      x: cx + 3,
      top: ceilingAt(world, cx + 3, level.rail - 2),
      floor: level.rail - 1,
    });
  }
  if (depth >= 3) {
    for (let k = 0; k < 3; k += 1) {
      const gx = room.x0 + 6 + Math.floor(rand() * Math.max(1, room.x1 - room.x0 - 10));
      crystal(world, gx, ceilingAt(world, gx, level.rail - 2), rand, false);
    }
    crystal(world, level.x1 - 2, level.rail - 1, rand, true);
  }
}

function decorateLevel(
  world: World,
  level: Level,
  groundY: number,
  rand: () => number,
  lanterns: Lantern[],
): void {
  const b = level.box;
  rails(world, level.x0, level.x1, level.rail);
  for (
    let x = level.x0 + 10 + Math.floor(hash(b.y, 3) * 20);
    x < level.x1 - 10;
    x += 58 + Math.floor(hash(x, b.y) * 26)
  ) {
    wood(world, x, level.y0 + 1, 3, level.rail - level.y0 - 1, true);
    wood(world, x + 11, level.y0 + 1, 3, level.rail - level.y0 - 1, true);
    wood(world, x - 2, level.y0, 18, 3, false);
  }
  for (const [lx, side] of [
    [b.x - 9, "left"],
    [b.x + b.w + 4, "right"],
  ] as const) {
    if (side === "left" && lx < level.x0 + 2) continue;
    world.rect(lx + 2, b.y + 2, 1, 4, "steel-edge");
    lanterns.push({
      x: lx,
      y: b.y + 6,
      state: level.state,
      seed: rand() * 9,
      level,
      isSmall: true,
    });
  }
  lanterns.push({
    x: level.x0 + 3,
    y: level.y0 + 4,
    state: level.state,
    seed: rand() * 9,
    level,
    isSmall: false,
  });
  if (level.isFront) {
    for (let x = b.x - 4; x < b.x + b.w + 4; x += 1) {
      for (let y = b.y - 10; y < b.y - 7; y += 1)
        world.put(x, y, (x + y) % 8 < 4 ? "alert" : "alert-ink");
    }
    for (let k = 0; k < 6; k += 1) {
      const rx = level.x0 + 4 + Math.floor(rand() * Math.max(1, b.x - level.x0 - 6));
      world.rect(rx, level.rail - 2, 3, 2, "rubble");
      world.put(rx + 1, level.rail - 3, "rubble-hi");
    }
    return;
  }
  const remaining = level.isDaily ? 0 : 3 - Math.max(0, level.stars);
  for (let k = 0; k < remaining; k += 1)
    level.veins.push(vein(world, level.x1 + 2, level.rail - 3 - k * 4, 3, rand, 2));
  for (let k = 0; k < (level.room ? 3 : 1); k += 1) {
    const vx = level.room
      ? level.room.x0 + 4 + Math.floor(rand() * (level.room.x1 - level.room.x0 - 8))
      : level.x1 - 10;
    vein(world, vx, level.y1 + 3 + Math.floor(rand() * 4), 3, rand, 3);
  }
  decorateRoom(world, level, groundY, rand, lanterns);
}

function toLevel(
  input: LevelInput,
  shaftX: number,
  xEnd: number,
  isFront: boolean,
  digId: number | null,
): Level {
  const b = input.box;
  const rail = b.y + b.h + 19;
  return {
    ...input,
    y0: b.y + b.h + 3,
    rail,
    y1: rail + 4,
    x0: shaftX + SHAFT_W,
    x1: xEnd,
    stopX: xEnd - 18,
    room: null,
    state: lanternState(input, isFront),
    veins: [],
    cart: null,
    isFront,
    isDigging: !isFront && digId !== null && input.id === digId,
  };
}

function setupDig(
  world: World,
  levels: Level[],
  shaftX: number,
  rock: { data: Uint8ClampedArray; mask: Uint8Array },
): Dig | null {
  const index = levels.findIndex((l) => l.isDigging);
  const level = levels[index];
  const prev = levels[index - 1];
  if (!level || !prev) {
    if (level) level.isDigging = false;
    return null;
  }
  const finalData = world.data.slice();
  const finalMask = world.mask.slice();
  const { W } = world;
  const restore = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    data: Uint8ClampedArray,
    mask: Uint8Array,
  ) => {
    const a = Math.max(0, Math.floor(x0));
    const z = Math.min(W, Math.ceil(x1));
    if (z <= a) return;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(world.H, Math.ceil(y1)); y += 1) {
      world.data.set(data.subarray((y * W + a) * 4, (y * W + z) * 4), (y * W + a) * 4);
      world.mask.set(mask.subarray(y * W + a, y * W + z), y * W + a);
    }
  };
  const shaftTop = prev.y1 + 1;
  const top = level.y0 - 1;
  restore(shaftX - 3, shaftTop, shaftX + SHAFT_W + 3, top, rock.data, rock.mask);
  restore(shaftX - 3, top, W, level.y1 + 3, rock.data, rock.mask);
  if (level.room) restore(level.room.x0 - 4, level.y0 - 22, W, top, rock.data, rock.mask);
  return {
    level,
    shaftTop,
    reveal: (x0, y0, x1, y1) => restore(x0, y0, x1, y1, finalData, finalMask),
  };
}

type Ground = {
  key: string;
  H: number;
  data: Uint8ClampedArray;
  mask: Uint8Array;
  shift: Float32Array;
  stars: World["stars"];
};

const GROUND_CHUNK = 256;
let groundCache: Ground | null = null;

function paintGround(world: World, groundY: number, moonX: number, isNarrow: boolean): void {
  const key = `${world.W}:${groundY}:${moonX}:${Object.keys(world.palette).length}`;
  if (!groundCache || groundCache.key !== key || groundCache.H < world.H) {
    const H = Math.ceil(world.H / GROUND_CHUNK) * GROUND_CHUNK + GROUND_CHUNK;
    const scratch = createWorld(world.W, H, world.palette);
    const rand = seeded(isNarrow ? 21 : 7);
    paintSky(scratch, groundY, rand, moonX);
    paintRock(scratch, groundY, rand);
    groundCache = {
      key,
      H,
      data: scratch.data,
      mask: scratch.mask,
      shift: scratch.shift,
      stars: scratch.stars,
    };
  }
  world.data.set(groundCache.data.subarray(0, world.W * world.H * 4));
  world.mask.set(groundCache.mask.subarray(0, world.W * world.H));
  world.shift.set(groundCache.shift);
  world.stars.push(...groundCache.stars);
  world.groundY = groundY;
}

export function buildMine(input: LayoutInput): Mine {
  const { W, H, isNarrow } = input;
  const world = createWorld(W, H, input.palette);
  const rand = seeded(isNarrow ? 21 : 7);
  const groundY = input.plate.y + input.plate.h + GROUND_BELOW_SIGN;
  const firstX = Math.min(input.front.x, ...input.levels.map((l) => l.box.x));
  const shaftX = Math.max(3, firstX - (isNarrow ? 22 : 44));
  const xEnd = W - (isNarrow ? 4 : 7);
  const bottomY = input.front.y + input.front.h + 18;
  const levels = input.levels.map((l) => toLevel(l, shaftX, xEnd, false, input.digId));
  const front = toLevel(
    { box: input.front, pit: null, stars: -1, isDaily: false, index: -1, id: -1 },
    shaftX,
    xEnd,
    true,
    null,
  );
  const all = [...levels, front];

  paintGround(world, groundY, isNarrow ? W - 24 : W - 70, isNarrow);
  const rock = levels.some((l) => l.isDigging)
    ? { data: world.data.slice(), mask: world.mask.slice() }
    : null;
  all.forEach((level, i) => {
    carveNiche(world, level.box, i * 17 + 5);
    if (level.pit) carvePit(world, level.pit, i * 13 + 2);
    carveLevel(world, level, i * 31, xEnd, isNarrow);
  });
  carve(world, shaftX, bottomY - 4, shaftX + SHAFT_W, bottomY + 6);
  caves(world, { shaftX, bottomY, groundY }, all, seeded(isNarrow ? 41 : 43));
  edges(world, groundY, H);
  paintShaft(world, shaftX, groundY - 1, bottomY + 6);
  const frame = headframe(world, shaftX, groundY);
  const lanterns: Lantern[] = [];
  for (const level of all) decorateLevel(world, level, groundY, rand, lanterns);
  for (const level of all) world.setMask(level.box.x, level.box.y, level.box.w, level.box.h, NICHE);
  const signLamp = billboard(world, input.plate, groundY);
  const dig = rock ? setupDig(world, levels, shaftX, rock) : null;
  const carts = levels.flatMap((l) => (l.cart ? [l.cart] : []));
  return {
    world,
    groundY,
    shaftX,
    bottomY,
    levels,
    front,
    lanterns,
    carts,
    ...frame,
    dig,
    signLamp,
  };
}
