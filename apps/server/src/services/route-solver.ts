import type { Dir, MineMap, Pos } from "@minescript/engine";

const COUNTER_CLOCKWISE: readonly Dir[] = ["east", "north", "west", "south"];
const DELTA: Record<Dir, Pos> = {
  east: { row: 0, col: 1 },
  north: { row: -1, col: 0 },
  west: { row: 0, col: -1 },
  south: { row: 1, col: 0 },
};
const QUARTER_TURNS = [1, 2, 3] as const;
const MAX_STEP = 100;
const EXHAUSTIVE_FIRST_LIMIT = 12;

type State = { row: number; col: number; dir: number };
type Leg = { lines: readonly string[]; end: State };

function isOpen(map: MineMap, row: number, col: number): boolean {
  const cell = map.cells[row]?.[col];
  return cell !== undefined && cell !== "wall";
}

function stateKey(map: MineMap, state: State): number {
  return (state.row * map.cols + state.col) * COUNTER_CLOCKWISE.length + state.dir;
}

function neighbours(map: MineMap, state: State): { next: State; line: string }[] {
  const moves = QUARTER_TURNS.map((turns) => ({
    next: { ...state, dir: (state.dir + turns) % COUNTER_CLOCKWISE.length },
    line: `turn by ${turns}`,
  }));
  const dir = COUNTER_CLOCKWISE[state.dir] ?? "east";
  const delta = DELTA[dir];
  for (let distance = 1; distance <= MAX_STEP; distance += 1) {
    const row = state.row + delta.row * distance;
    const col = state.col + delta.col * distance;
    if (!isOpen(map, row, col)) {
      break;
    }
    moves.push({ next: { row, col, dir: state.dir }, line: `step forward ${distance}` });
  }
  return moves;
}

function searchFrom(map: MineMap, start: State) {
  const previous = new Map<number, { from: State; line: string } | null>();
  const reached: State[] = [start];
  previous.set(stateKey(map, start), null);
  for (let index = 0; index < reached.length; index += 1) {
    const state = reached[index];
    if (!state) {
      break;
    }
    for (const move of neighbours(map, state)) {
      const key = stateKey(map, move.next);
      if (!previous.has(key)) {
        previous.set(key, { from: state, line: move.line });
        reached.push(move.next);
      }
    }
  }
  return { previous, reached };
}

function legTo(
  map: MineMap,
  search: ReturnType<typeof searchFrom>,
  target: Pos,
): { lines: string[]; end: State } | null {
  const end = search.reached.find((state) => state.row === target.row && state.col === target.col);
  if (!end) {
    return null;
  }
  const lines: string[] = [];
  let cursor: State = end;
  for (;;) {
    const link = search.previous.get(stateKey(map, cursor));
    if (!link) {
      break;
    }
    lines.push(link.line);
    cursor = link.from;
  }
  return { lines: lines.reverse(), end };
}

function goldCells(map: MineMap): Pos[] {
  return map.cells.flatMap((row, rowIndex) =>
    row.flatMap((cell, col) => (cell === "gold" ? [{ row: rowIndex, col }] : [])),
  );
}

function greedyTour(map: MineMap, start: State, golds: readonly Pos[], first?: Pos): string[] {
  const remaining = [...golds];
  const lines: string[] = [];
  let state = start;
  let forced = first;
  while (remaining.length > 0) {
    const search = searchFrom(map, state);
    let best: { index: number; leg: Leg } | null = null;
    for (const [index, gold] of remaining.entries()) {
      if (forced && (gold.row !== forced.row || gold.col !== forced.col)) {
        continue;
      }
      const leg = legTo(map, search, gold);
      if (leg && (!best || leg.lines.length < best.leg.lines.length)) {
        best = { index, leg };
      }
    }
    forced = undefined;
    if (!best) {
      break;
    }
    lines.push(...best.leg.lines, "mine here");
    state = best.leg.end;
    remaining.splice(best.index, 1);
  }
  return lines;
}

export function solveRoute(map: MineMap): string | null {
  const start: State = {
    row: map.robot.row,
    col: map.robot.col,
    dir: Math.max(0, COUNTER_CLOCKWISE.indexOf(map.dir)),
  };
  const search = searchFrom(map, start);
  const reachable = goldCells(map).filter((gold) => legTo(map, search, gold) !== null);
  if (reachable.length === 0) {
    return null;
  }
  const candidates =
    reachable.length <= EXHAUSTIVE_FIRST_LIMIT
      ? reachable.map((first) => greedyTour(map, start, reachable, first))
      : [greedyTour(map, start, reachable)];
  const shortest = candidates.reduce((best, lines) => (lines.length < best.length ? lines : best));
  return shortest.join("\n");
}
