import type { Engine } from "@minescript/engine";
import { solveRoute } from "./route-solver.ts";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const GENERATOR_MIN = 5;
export const GENERATOR_MAX = 15;

type Tuning = { loops: number; goldShare: number; goldMin: number; goldMax: number };

const TUNING: Record<Difficulty, Tuning> = {
  easy: { loops: 0.45, goldShare: 0.06, goldMin: 2, goldMax: 4 },
  medium: { loops: 0.15, goldShare: 0.08, goldMin: 3, goldMax: 6 },
  hard: { loops: 0.03, goldShare: 0.1, goldMin: 5, goldMax: 9 },
};

const ROBOT_SYMBOL = { east: ">", north: "^", west: "<", south: "v" } as const;
const DIRS = ["east", "north", "west", "south"] as const;
const STEPS = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
] as const;
const UINT32 = 0x1_0000_0000;
const EDGE_OPEN_SHARE = 0.5;

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32;
  };
}

export function seedFromText(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    const other = copy[swap];
    if (current !== undefined && other !== undefined) {
      copy[index] = other;
      copy[swap] = current;
    }
  }
  return copy;
}

type Grid = string[][];

function isOpen(grid: Grid, row: number, col: number): boolean {
  const cell = grid[row]?.[col];
  return cell !== undefined && cell !== "#";
}

function openNeighbours(grid: Grid, row: number, col: number): number {
  return STEPS.filter(([dRow, dCol]) => isOpen(grid, row + dRow, col + dCol)).length;
}

function carveMaze(grid: Grid, rows: number, cols: number, random: () => number): void {
  const startRow = 2 * Math.floor(random() * Math.ceil(rows / 2));
  const startCol = 2 * Math.floor(random() * Math.ceil(cols / 2));
  const stack: [number, number][] = [[startRow, startCol]];
  const setOpen = (row: number, col: number) => {
    const line = grid[row];
    if (line) {
      line[col] = ".";
    }
  };
  setOpen(startRow, startCol);
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top) {
      break;
    }
    const [row, col] = top;
    const options = shuffled(STEPS, random).filter(([dRow, dCol]) => {
      const nextRow = row + dRow * 2;
      const nextCol = col + dCol * 2;
      return grid[nextRow]?.[nextCol] === "#";
    });
    const choice = options[0];
    if (!choice) {
      stack.pop();
      continue;
    }
    const [dRow, dCol] = choice;
    setOpen(row + dRow, col + dCol);
    setOpen(row + dRow * 2, col + dCol * 2);
    stack.push([row + dRow * 2, col + dCol * 2]);
  }
}

function openWalls(grid: Grid, share: number, random: () => number): void {
  grid.forEach((line, row) => {
    line.forEach((cell, col) => {
      if (cell !== "#") {
        return;
      }
      const horizontal = isOpen(grid, row, col - 1) && isOpen(grid, row, col + 1);
      const vertical = isOpen(grid, row - 1, col) && isOpen(grid, row + 1, col);
      const isEdgeStrip =
        (row === grid.length - 1 && grid.length % 2 === 0) ||
        (col === line.length - 1 && line.length % 2 === 0);
      const touchesOpen = openNeighbours(grid, row, col) > 0;
      if (
        ((horizontal || vertical) && random() < share) ||
        (isEdgeStrip && touchesOpen && random() < EDGE_OPEN_SHARE)
      ) {
        line[col] = ".";
      }
    });
  });
}

function openCells(grid: Grid): [number, number][] {
  return grid.flatMap((line, row) =>
    line.flatMap((cell, col): [number, number][] => (cell === "." ? [[row, col]] : [])),
  );
}

export type GeneratorInput = {
  rows: number;
  cols: number;
  difficulty: Difficulty;
  seed: number;
};

export function generateLayout(input: GeneratorInput): string {
  const random = seededRandom(input.seed);
  const tuning = TUNING[input.difficulty];
  const grid: Grid = Array.from({ length: input.rows }, () => Array(input.cols).fill("#"));
  carveMaze(grid, input.rows, input.cols, random);
  openWalls(grid, tuning.loops, random);
  const cells = shuffled(openCells(grid), random);
  const deadEnds = cells.filter(([row, col]) => openNeighbours(grid, row, col) <= 1);
  const wanted = Math.round(cells.length * tuning.goldShare);
  const goldCount = Math.min(
    Math.max(tuning.goldMin, Math.min(tuning.goldMax, wanted)),
    cells.length - 1,
  );
  const preferDeadEnds = input.difficulty !== "easy";
  const ordered = preferDeadEnds
    ? [...deadEnds, ...cells.filter((cell) => !deadEnds.includes(cell))]
    : cells;
  const golds = ordered.slice(0, goldCount);
  for (const [row, col] of golds) {
    const line = grid[row];
    if (line) {
      line[col] = "@";
    }
  }
  const robotCell = cells.find(([row, col]) => grid[row]?.[col] === ".") ?? [0, 0];
  const [robotRow, robotCol] = robotCell;
  const facing = shuffled([0, 1, 2, 3], random).find((index) => {
    const step = STEPS[index];
    return step ? isOpen(grid, robotRow + step[0], robotCol + step[1]) : false;
  });
  const dir = DIRS[facing ?? 0] ?? "east";
  const robotLine = grid[robotRow];
  if (robotLine) {
    robotLine[robotCol] = ROBOT_SYMBOL[dir];
  }
  return `${input.rows} ${input.cols}\n${grid.map((line) => line.join("")).join("\n")}\n`;
}

export function computeParSteps(engine: Engine, content: string): number | null {
  const parsed = engine.parseMap(content);
  if (!parsed.map) {
    return null;
  }
  const program = solveRoute(parsed.map);
  if (program === null) {
    return null;
  }
  const info = engine.mapInfo(parsed.map);
  const result = engine.run(program, content);
  const isComplete = result.outcome.kind === "ok" && result.gold === info.reachableGold;
  return isComplete ? result.steps : null;
}

export function generateMap(
  engine: Engine,
  input: GeneratorInput,
): { content: string; parSteps: number | null } {
  const content = generateLayout(input);
  return { content, parSteps: computeParSteps(engine, content) };
}

const EASY_MAX_STEPS = 12;
const MEDIUM_MAX_STEPS = 40;
const DIFFICULTY_CACHE_LIMIT = 500;
const difficultyCache = new Map<string, Difficulty | null>();

export function difficultyOf(engine: Engine, content: string, cacheKey: string): Difficulty | null {
  const cached = difficultyCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const steps = computeParSteps(engine, content);
  const difficulty =
    steps === null
      ? null
      : steps <= EASY_MAX_STEPS
        ? "easy"
        : steps <= MEDIUM_MAX_STEPS
          ? "medium"
          : "hard";
  if (difficultyCache.size >= DIFFICULTY_CACHE_LIMIT) {
    difficultyCache.clear();
  }
  difficultyCache.set(cacheKey, difficulty);
  return difficulty;
}
