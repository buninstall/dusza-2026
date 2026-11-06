import type { Cell, MineMap, Pos, RobotState } from "@minescript/engine";
import { cellNames, dirNames } from "../i18n/hu.ts";

export const posKey = (pos: Pos): string => `${pos.row}:${pos.col}`;

export type CellView = {
  pos: Pos;
  cell: Cell;
  hasRobot: boolean;
  isHidden: boolean;
  isDimmed: boolean;
  isMined: boolean;
};

export type GridMode = "edit" | "view" | "fog";

export function cellAt(map: MineMap, pos: Pos): Cell {
  return map.cells[pos.row]?.[pos.col] ?? "empty";
}

export function describeCell(view: CellView, robot: RobotState | null): string {
  const where = `${view.pos.row + 1}. sor, ${view.pos.col + 1}. oszlop`;
  if (view.isHidden) {
    return `${where}: felderítetlen`;
  }
  const visibleCell = view.isMined ? "empty" : view.cell;
  const content = cellNames[visibleCell];
  if (view.hasRobot && robot) {
    const onGold = visibleCell === "gold" ? ", aranyon áll" : "";
    return `${where}: robot, ${dirNames[robot.dir]} felé${onGold}`;
  }
  const explored = view.isDimmed ? ", még nem felfedezett" : "";
  return `${where}: ${content}${explored}`;
}

export function cellViews(
  map: MineMap,
  mode: GridMode,
  robot: RobotState | null,
  discovered: ReadonlySet<string> | undefined,
  mined: ReadonlySet<string> | undefined,
): CellView[][] {
  return map.cells.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      const pos = { row: rowIndex, col: colIndex };
      const key = posKey(pos);
      const known = discovered ? discovered.has(key) : true;
      return {
        pos,
        cell,
        hasRobot: robot !== null && robot.pos.row === rowIndex && robot.pos.col === colIndex,
        isHidden: mode === "fog" && !known,
        isDimmed: mode === "view" && !known,
        isMined: mined?.has(key) ?? false,
      };
    }),
  );
}
