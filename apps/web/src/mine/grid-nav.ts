import type { Pos } from "@minescript/engine";

export type GridKeyEvent = { key: string; ctrlKey: boolean; metaKey: boolean };

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

export function clampPos(pos: Pos, rows: number, cols: number): Pos {
  return { row: clamp(pos.row, rows - 1), col: clamp(pos.col, cols - 1) };
}

export function moveFocus(event: GridKeyEvent, focus: Pos, rows: number, cols: number): Pos | null {
  const lastRow = rows - 1;
  const lastCol = cols - 1;
  const isJump = event.ctrlKey || event.metaKey;
  switch (event.key) {
    case "ArrowUp":
      return { row: clamp(focus.row - 1, lastRow), col: focus.col };
    case "ArrowDown":
      return { row: clamp(focus.row + 1, lastRow), col: focus.col };
    case "ArrowLeft":
      return { row: focus.row, col: clamp(focus.col - 1, lastCol) };
    case "ArrowRight":
      return { row: focus.row, col: clamp(focus.col + 1, lastCol) };
    case "Home":
      return isJump ? { row: 0, col: 0 } : { row: focus.row, col: 0 };
    case "End":
      return isJump ? { row: lastRow, col: lastCol } : { row: focus.row, col: lastCol };
    case "PageUp":
      return { row: 0, col: focus.col };
    case "PageDown":
      return { row: lastRow, col: focus.col };
    default:
      return null;
  }
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}
