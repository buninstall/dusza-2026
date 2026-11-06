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
