import type { Cell, Dir, MineMap, Pos } from "@minescript/engine";

export const MIN_SIZE = 1;
export const MAX_SIZE = 15;

export type Tool = "empty" | "gold" | "wall" | "robot";

export type DraftMap = {
  rows: number;
  cols: number;
  cells: Cell[][];
  robot: Pos | null;
  dir: Dir;
};

const SYMBOL: Record<Cell, string> = { empty: ".", gold: "@", wall: "#" };
const DIR_SYMBOL: Record<Dir, string> = { north: "^", east: ">", south: "v", west: "<" };

function clampSize(value: number): number {
  return Math.min(Math.max(Math.trunc(value) || MIN_SIZE, MIN_SIZE), MAX_SIZE);
}

export function emptyDraft(rows = 6, cols = 10): DraftMap {
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
  const robot =
    draft.robot && draft.robot.row < nextRows && draft.robot.col < nextCols ? draft.robot : null;
  return { ...draft, rows: nextRows, cols: nextCols, cells, robot };
}

export function paint(draft: DraftMap, pos: Pos, tool: Tool, dir: Dir): DraftMap {
  const cells = draft.cells.map((row) => [...row]);
  const target = cells[pos.row];
  if (!target || pos.col >= target.length) {
    return draft;
  }
  if (tool === "robot") {
    target[pos.col] = "empty";
    return { ...draft, cells, robot: { ...pos }, dir };
  }
  target[pos.col] = tool;
  const coversRobot = draft.robot?.row === pos.row && draft.robot.col === pos.col;
  return { ...draft, cells, robot: coversRobot ? null : draft.robot };
}

export function draftToText(draft: DraftMap): string {
  const rows = draft.cells.map((row, rowIndex) =>
    row
      .map((cell, colIndex) =>
        draft.robot?.row === rowIndex && draft.robot.col === colIndex
          ? DIR_SYMBOL[draft.dir]
          : SYMBOL[cell],
      )
      .join(""),
  );
  return `${draft.rows} ${draft.cols}\n${rows.join("\n")}\n`;
}

export function draftForDisplay(draft: DraftMap): MineMap {
  return {
    rows: draft.rows,
    cols: draft.cols,
    cells: draft.cells,
    robot: draft.robot ?? { row: 0, col: 0 },
    dir: draft.dir,
  };
}
