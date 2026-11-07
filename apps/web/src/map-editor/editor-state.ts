import type { Cell, Dir, MineMap, Pos, RobotState } from "@minescript/engine";

export const MIN_SIZE = 1;
export const MAX_SIZE = 15;
export const DEFAULT_ROWS = 7;
export const DEFAULT_COLS = 10;

export type Tool = "empty" | "gold" | "wall" | "robot";

export const TOOLS: readonly Tool[] = ["empty", "gold", "wall", "robot"];

export type DraftMap = {
  rows: number;
  cols: number;
  cells: Cell[][];
  robot: Pos | null;
  dir: Dir;
};

const CELL_SYMBOL: Record<Cell, string> = { empty: ".", gold: "@", wall: "#" };
const DIR_SYMBOL: Record<Dir, string> = { north: "^", east: ">", south: "v", west: "<" };

export function clampSize(value: number): number {
  const whole = Number.isFinite(value) ? Math.trunc(value) : MIN_SIZE;
  return Math.min(Math.max(whole, MIN_SIZE), MAX_SIZE);
}

export function emptyDraft(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): DraftMap {
  const safeRows = clampSize(rows);
  const safeCols = clampSize(cols);
  return {
    rows: safeRows,
    cols: safeCols,
    cells: Array.from({ length: safeRows }, () => Array<Cell>(safeCols).fill("empty")),
    robot: { row: 0, col: 0 },
    dir: "east",
  };
}

export function draftFromMap(map: MineMap): DraftMap {
  return {
    rows: map.rows,
    cols: map.cols,
    cells: map.cells.map((row) => [...row]),
    robot: { ...map.robot },
    dir: map.dir,
  };
}

export function resizeDraft(draft: DraftMap, rows: number, cols: number): DraftMap {
  const nextRows = clampSize(rows);
  const nextCols = clampSize(cols);
  const cells = Array.from({ length: nextRows }, (_, row) =>
    Array.from({ length: nextCols }, (_, col): Cell => draft.cells[row]?.[col] ?? "empty"),
  );
  const keepsRobot =
    draft.robot !== null && draft.robot.row < nextRows && draft.robot.col < nextCols;
  return {
    ...draft,
    rows: nextRows,
    cols: nextCols,
    cells,
    robot: keepsRobot ? draft.robot : null,
  };
}

function isInside(draft: DraftMap, pos: Pos): boolean {
  return pos.row >= 0 && pos.row < draft.rows && pos.col >= 0 && pos.col < draft.cols;
}

function withCell(cells: Cell[][], pos: Pos, cell: Cell): Cell[][] {
  return cells.map((row, rowIndex) =>
    rowIndex === pos.row
      ? row.map((current, colIndex) => (colIndex === pos.col ? cell : current))
      : row,
  );
}

export function paint(draft: DraftMap, pos: Pos, tool: Tool, dir: Dir): DraftMap {
  if (!isInside(draft, pos)) {
    return draft;
  }
  if (tool === "robot") {
    return { ...draft, cells: withCell(draft.cells, pos, "empty"), robot: { ...pos }, dir };
  }
  const coversRobot = draft.robot?.row === pos.row && draft.robot.col === pos.col;
  if (coversRobot && tool !== "empty") {
    return draft;
  }
  return {
    ...draft,
    cells: withCell(draft.cells, pos, tool),
    robot: coversRobot ? null : draft.robot,
  };
}

export function turnRobot(draft: DraftMap, dir: Dir): DraftMap {
  return { ...draft, dir };
}

export function draftToText(draft: DraftMap): string {
  const rows = draft.cells.map((row, rowIndex) =>
    row
      .map((cell, colIndex) =>
        draft.robot?.row === rowIndex && draft.robot.col === colIndex
          ? DIR_SYMBOL[draft.dir]
          : CELL_SYMBOL[cell],
      )
      .join(""),
  );
  return `${draft.rows} ${draft.cols}\n${rows.join("\n")}\n`;
}

export function draftGrid(draft: DraftMap): MineMap {
  return {
    rows: draft.rows,
    cols: draft.cols,
    cells: draft.cells,
    robot: draft.robot ?? { row: 0, col: 0 },
    dir: draft.dir,
  };
}

export function draftRobot(draft: DraftMap): RobotState | null {
  return draft.robot ? { pos: draft.robot, dir: draft.dir } : null;
}

export function toolForKey(key: string): Tool | null {
  const index = Number.parseInt(key, 10) - 1;
  return TOOLS[index] ?? null;
}

export type Mode = "brush" | "rect" | "fill";

export const MODES: readonly Mode[] = ["brush", "rect", "fill"];

const MODE_KEYS: Readonly<Record<string, Mode>> = { e: "brush", t: "rect", k: "fill" };

export function modeForKey(key: string): Mode | null {
  return MODE_KEYS[key.toLowerCase()] ?? null;
}

const posKeyOf = (pos: Pos): string => `${pos.row}:${pos.col}`;

export function rectCells(a: Pos, b: Pos): Pos[] {
  const top = Math.min(a.row, b.row);
  const left = Math.min(a.col, b.col);
  const bottom = Math.max(a.row, b.row);
  const right = Math.max(a.col, b.col);
  const cells: Pos[] = [];
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      cells.push({ row, col });
    }
  }
  return cells;
}

export function lineCells(a: Pos, b: Pos): Pos[] {
  const cells: Pos[] = [];
  const dRow = Math.abs(b.row - a.row);
  const dCol = Math.abs(b.col - a.col);
  const stepRow = a.row < b.row ? 1 : -1;
  const stepCol = a.col < b.col ? 1 : -1;
  let error = dCol - dRow;
  let row = a.row;
  let col = a.col;
  cells.push({ row, col });
  while (row !== b.row || col !== b.col) {
    const doubled = 2 * error;
    if (doubled > -dRow) {
      error -= dRow;
      col += stepCol;
    }
    if (doubled < dCol) {
      error += dCol;
      row += stepRow;
    }
    cells.push({ row, col });
  }
  return cells;
}

const NEIGHBOURS: readonly Pos[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

function contentAt(draft: DraftMap, pos: Pos): Cell {
  return draft.cells[pos.row]?.[pos.col] ?? "empty";
}

function spread(draft: DraftMap, start: Pos, isOpen: (pos: Pos) => boolean): Pos[] {
  const seen = new Set([posKeyOf(start)]);
  const queue = [start];
  const cells: Pos[] = [];
  for (let head = 0; head < queue.length; head += 1) {
    const pos = queue[head] as Pos;
    cells.push(pos);
    for (const delta of NEIGHBOURS) {
      const next = { row: pos.row + delta.row, col: pos.col + delta.col };
      if (isInside(draft, next) && !seen.has(posKeyOf(next)) && isOpen(next)) {
        seen.add(posKeyOf(next));
        queue.push(next);
      }
    }
  }
  return cells;
}

export function floodCells(draft: DraftMap, start: Pos): Pos[] {
  if (!isInside(draft, start)) {
    return [];
  }
  const target = contentAt(draft, start);
  return spread(draft, start, (pos) => contentAt(draft, pos) === target);
}

export function reachableCells(draft: DraftMap): ReadonlySet<string> {
  if (!draft.robot) {
    return new Set();
  }
  return new Set(
    spread(draft, draft.robot, (pos) => contentAt(draft, pos) !== "wall").map(posKeyOf),
  );
}

export function paintCells(draft: DraftMap, cells: readonly Pos[], tool: Tool): DraftMap {
  if (tool === "robot") {
    const last = cells[cells.length - 1];
    return last ? paint(draft, last, "robot", draft.dir) : draft;
  }
  return cells.reduce((current, pos) => paint(current, pos, tool, current.dir), draft);
}

const LEFT_OF: Record<Dir, Dir> = { north: "west", west: "south", south: "east", east: "north" };
const RIGHT_OF: Record<Dir, Dir> = { north: "east", east: "south", south: "west", west: "north" };

export function rotateRobot(draft: DraftMap, side: "left" | "right"): DraftMap {
  return { ...draft, dir: side === "left" ? LEFT_OF[draft.dir] : RIGHT_OF[draft.dir] };
}

function isRobotAt(draft: DraftMap, pos: Pos): boolean {
  return draft.robot?.row === pos.row && draft.robot.col === pos.col;
}

export function changedCells(before: DraftMap, after: DraftMap): Pos[] {
  const cells: Pos[] = [];
  for (let row = 0; row < after.rows; row += 1) {
    for (let col = 0; col < after.cols; col += 1) {
      const pos = { row, col };
      const wasRobot = isRobotAt(before, pos);
      const isRobot = isRobotAt(after, pos);
      const turned = isRobot && before.dir !== after.dir;
      if (contentAt(before, pos) !== contentAt(after, pos) || wasRobot !== isRobot || turned) {
        cells.push(pos);
      }
    }
  }
  return cells;
}

function isRobotCellAt(draft: DraftMap, row: number, col: number): boolean {
  return draft.robot?.row === row && draft.robot.col === col;
}

export function frameDraft(draft: DraftMap): DraftMap {
  const robot = draft.robot;
  const isBesideRobot = (row: number, col: number) =>
    robot !== null && Math.abs(robot.row - row) + Math.abs(robot.col - col) <= 1;
  const isEdge = (row: number, col: number) =>
    (row === 0 || col === 0 || row === draft.rows - 1 || col === draft.cols - 1) &&
    !isBesideRobot(row, col);
  return {
    ...draft,
    cells: draft.cells.map((line, row) =>
      line.map(
        (cell, col): Cell => (isEdge(row, col) && !isRobotCellAt(draft, row, col) ? "wall" : cell),
      ),
    ),
  };
}

export function clearDraft(draft: DraftMap): DraftMap {
  return { ...draft, cells: draft.cells.map((line) => line.map((): Cell => "empty")) };
}
