export const FLOOR = 0;
export const ROCK = 1;
export const GOLD = 2;
export const HOLE = 3;

export type Tile = typeof FLOOR | typeof ROCK | typeof GOLD | typeof HOLE;
export type Cell = readonly [number, number];
export type TileRect = { c0: number; c1: number; r0: number; r1: number };

export type Mine = {
  cols: number;
  rows: number;
  grid: Uint8Array;
  golds: readonly Cell[];
  at: (c: number, r: number) => number;
};

export type MineOptions = {
  cols: number;
  rows: number;
  hole: TileRect;
  seed: number;
  branchEvery: number;
  upward: boolean;
};

const NEIGHBOURS: readonly Cell[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const RING_GOLD_CHANCE = 0.035;
const EXTRA_GOLD_CHANCE = 0.45;
const TURN_CHANCE = 0.28;
const WIDE_CHANCE = 0.45;
const UPWARD_CHANCE = 0.7;

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isOpen(tile: number): boolean {
  return tile === FLOOR || tile === GOLD;
}

function outwardStep(cell: Cell, hole: TileRect): Cell {
  const [c, r] = cell;
  if (c < hole.c0) return [-1, 0];
  if (c > hole.c1) return [1, 0];
  if (r < hole.r0) return [0, -1];
  return [0, 1];
}

export function generateMine(options: MineOptions): Mine {
  const { cols, rows, hole } = options;
  const rand = seeded(options.seed);
  const grid = new Uint8Array(cols * rows).fill(ROCK);
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  const at = (c: number, r: number) => (inside(c, r) ? (grid[r * cols + c] ?? ROCK) : ROCK);
  const set = (c: number, r: number, tile: Tile) => {
    if (c < 1 || r < 1 || c >= cols - 1 || r >= rows - 1 || at(c, r) === HOLE) return;
    grid[r * cols + c] = tile;
  };
  const distance = (c: number, r: number) =>
    Math.max(hole.c0 - c, c - hole.c1, hole.r0 - r, r - hole.r1, 0);
  const isVisible = (c: number, r: number) => c >= 1 && r >= 1 && c <= cols - 2 && r <= rows - 2;

  for (let r = Math.max(0, hole.r0); r <= Math.min(rows - 1, hole.r1); r += 1) {
    for (let c = Math.max(0, hole.c0); c <= Math.min(cols - 1, hole.c1); c += 1) {
      grid[r * cols + c] = HOLE;
    }
  }

  const ring: Cell[] = [];
  for (let r = hole.r0 - 3; r <= hole.r1 + 3; r += 1) {
    for (let c = hole.c0 - 3; c <= hole.c1 + 3; c += 1) {
      const d = distance(c, r);
      const wave = Math.sin(c * 0.9 + r * 0.4) + Math.sin(r * 1.3 - c * 0.5);
      if (d === 1) {
        set(c, r, FLOOR);
        if (isVisible(c, r)) ring.push([c, r]);
      } else if ((d === 2 && wave > -0.6) || (d === 3 && wave > 1.25)) {
        set(c, r, FLOOR);
      }
    }
  }

  const golds: Cell[] = [];
  const placeGold = (c: number, r: number) => {
    if (isVisible(c, r) && at(c, r) === FLOOR) {
      set(c, r, GOLD);
      golds.push([c, r]);
    }
  };

  const count = Math.max(4, Math.round(ring.length / options.branchEvery));
  for (let b = 0; b < count && ring.length > 0; b += 1) {
    const startCell = ring[Math.floor(((b + rand() * 0.6) / count) * ring.length) % ring.length];
    if (!startCell) continue;
    let [dc, dr] =
      options.upward && rand() < UPWARD_CHANCE ? [0, -1] : outwardStep(startCell, hole);
    let [c, r] = startCell;
    const length = 3 + Math.floor(rand() * 6);
    const isWide = rand() < WIDE_CHANCE;
    for (let step = 0; step < length; step += 1) {
      if (step > 1 && rand() < TURN_CHANCE) {
        const turn = rand() < 0.5 ? 1 : -1;
        [dc, dr] = dc !== 0 ? [0, turn] : [turn, 0];
      }
      const nc = c + dc;
      const nr = r + dr;
      if (distance(nc, nr) < 1 || nc < 2 || nr < 2 || nc > cols - 3 || nr > rows - 3) {
        [dc, dr] = [-dr, dc];
        continue;
      }
      c = nc;
      r = nr;
      set(c, r, FLOOR);
      if (isWide) set(c + Math.abs(dr), r + Math.abs(dc), FLOOR);
    }
    const radius = 1.1 + rand() * 1.3;
    for (let y = -3; y <= 3; y += 1) {
      for (let x = -3; x <= 3; x += 1) {
        if (x * x + y * y <= radius * radius + rand() * 0.8 && distance(c + x, r + y) >= 1) {
          set(c + x, r + y, FLOOR);
        }
      }
    }
    placeGold(c, r);
    if (rand() < EXTRA_GOLD_CHANCE) {
      placeGold(c + (rand() < 0.5 ? -1 : 1), r + (rand() < 0.5 ? -1 : 0));
    }
  }

  for (const [c, r] of ring) {
    const open = NEIGHBOURS.filter(([dc, dr]) => at(c + dc, r + dr) === FLOOR).length;
    if (open >= 2 && rand() < RING_GOLD_CHANCE) placeGold(c, r);
  }

  return { cols, rows, grid, golds, at };
}

export function findPath(mine: Mine, from: Cell, to: Cell): Cell[] | null {
  const { cols, rows } = mine;
  const key = (c: number, r: number) => r * cols + c;
  const previous = new Int32Array(cols * rows).fill(-2);
  const start = key(from[0], from[1]);
  const target = key(to[0], to[1]);
  previous[start] = -1;
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] ?? target;
    if (current === target) break;
    const c = current % cols;
    const r = Math.floor(current / cols);
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const k = key(nc, nr);
      if (previous[k] !== -2 || !isOpen(mine.at(nc, nr))) continue;
      previous[k] = current;
      queue.push(k);
    }
  }
  if (previous[target] === -2) return null;
  const path: Cell[] = [];
  for (let k = target; k !== -1; k = previous[k] ?? -1) {
    path.push([k % cols, Math.floor(k / cols)]);
  }
  return path.reverse();
}

export function planTour(mine: Mine, start: Cell, center: Cell): Cell[][] {
  const angle = ([c, r]: Cell) => Math.atan2(r - center[1], c - center[0]);
  const base = angle(start);
  const turn = (cell: Cell) => (angle(cell) - base + Math.PI * 4) % (Math.PI * 2);
  const targets = [...mine.golds].sort((a, b) => turn(a) - turn(b));
  const legs: Cell[][] = [];
  let from = start;
  for (const target of [...targets, start]) {
    const path = findPath(mine, from, target);
    if (path && path.length > 1) {
      legs.push(path);
      from = target;
    }
  }
  return legs;
}
