import type { Diagnostic, Pos } from "@minescript/engine";
import { hu } from "../i18n/hu.ts";
import { posKey } from "../mine/tiles-model.ts";
import { type DraftMap, reachableCells } from "./editor-state.ts";
import type { RectDraft } from "./useCanvasTools.ts";

export function splitDiagnostics(diagnostics: readonly Diagnostic[]) {
  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity !== "error"),
  };
}

function lostOn(draft: DraftMap, cells: readonly Pos[]): string | null {
  const gold = cells.filter((pos) => draft.cells[pos.row]?.[pos.col] === "gold").length;
  const losesRobot = cells.some(
    (pos) => draft.robot?.row === pos.row && draft.robot.col === pos.col,
  );
  const notes = [
    ...(losesRobot ? [hu.mapEditor.sizeLosesRobot] : []),
    ...(gold > 0 ? [hu.mapEditor.sizeLosesGold(gold)] : []),
  ];
  return notes.length > 0 ? notes.join(" ") : null;
}

export function doomNotes(draft: DraftMap): { row: string | null; col: string | null } {
  const lastRow = Array.from({ length: draft.cols }, (_, col) => ({ row: draft.rows - 1, col }));
  const lastCol = Array.from({ length: draft.rows }, (_, row) => ({ row, col: draft.cols - 1 }));
  return {
    row: draft.rows > 1 ? lostOn(draft, lastRow) : null,
    col: draft.cols > 1 ? lostOn(draft, lastCol) : null,
  };
}

export function shroudedCells(draft: DraftMap): Pos[] {
  const reachable = reachableCells(draft);
  return draft.cells.flatMap((row, rowIndex) =>
    row.flatMap((cell, colIndex) => {
      const pos = { row: rowIndex, col: colIndex };
      return cell !== "wall" && !reachable.has(posKey(pos)) ? [pos] : [];
    }),
  );
}

export function rectTag(rect: RectDraft | null): string {
  if (!rect) {
    return "";
  }
  const rows = Math.abs(rect.anchor.row - rect.end.row) + 1;
  const cols = Math.abs(rect.anchor.col - rect.end.col) + 1;
  return hu.mapEditor.rectSize(rows, cols);
}

export function unreachableMarks(unreachable: readonly Pos[]) {
  return {
    notes: new Map(unreachable.map((pos) => [posKey(pos), hu.mapEditor.unreachableNote])),
    rulers: {
      rows: new Set(unreachable.map((pos) => pos.row)),
      cols: new Set(unreachable.map((pos) => pos.col)),
    },
  };
}
