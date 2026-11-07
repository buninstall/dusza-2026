import type { Cell, MineMap, Pos, RobotState } from "@minescript/engine";
import { cellNames, dirNames, hu } from "../i18n/hu.ts";
import type { FringeSide } from "../pixel/tiles.ts";

export const posKey = (pos: Pos): string => `${pos.row}:${pos.col}`;

export type FogMode = "lamp" | "full";

export type Exploration = {
  discovered: ReadonlySet<string>;
  mined: ReadonlySet<string>;
  mode: FogMode;
  lit?: ReadonlySet<string> | undefined;
};

export type TileKind = "floor" | "wall" | "gold" | "mined";

export type Lighting = "lit" | "dark" | "shrouded";

export type TileView = {
  pos: Pos;
  kind: TileKind;
  lighting: Lighting;
  fringe: readonly FringeSide[];
  hasRobot: boolean;
  isLampLit: boolean;
  isSealed: boolean;
};

const NEIGHBOURS: readonly { side: FringeSide; dRow: number; dCol: number }[] = [
  { side: "north", dRow: -1, dCol: 0 },
  { side: "east", dRow: 0, dCol: 1 },
  { side: "south", dRow: 1, dCol: 0 },
  { side: "west", dRow: 0, dCol: -1 },
];

export function tileKind(cell: Cell, isMined: boolean): TileKind {
  if (cell === "gold") {
    return isMined ? "mined" : "gold";
  }
  return cell === "wall" ? "wall" : "floor";
}

function isRobotAt(robot: RobotState | null, pos: Pos): boolean {
  return robot !== null && robot.pos.row === pos.row && robot.pos.col === pos.col;
}

function isBeside(robot: RobotState | null, pos: Pos): boolean {
  if (robot === null) {
    return false;
  }
  return Math.abs(robot.pos.row - pos.row) + Math.abs(robot.pos.col - pos.col) === 1;
}

function isVisible(key: string, exploration: Exploration): boolean {
  return exploration.discovered.has(key) || (exploration.lit?.has(key) ?? false);
}

function litNeighbourSides(pos: Pos, exploration: Exploration): FringeSide[] {
  return NEIGHBOURS.filter(({ dRow, dCol }) =>
    isVisible(posKey({ row: pos.row + dRow, col: pos.col + dCol }), exploration),
  ).map(({ side }) => side);
}

function lightingFor(isKnown: boolean, key: string, exploration: Exploration | null): Lighting {
  if (exploration === null || isKnown) {
    return "lit";
  }
  if (exploration.mode !== "lamp") {
    return "shrouded";
  }
  return exploration.lit?.has(key) ? "shrouded" : "dark";
}

export function buildTiles(
  map: MineMap,
  robot: RobotState | null,
  exploration: Exploration | null,
): TileView[][] {
  return map.cells.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      const pos = { row: rowIndex, col: colIndex };
      const key = posKey(pos);
      const hasRobot = isRobotAt(robot, pos);
      const isKnown = hasRobot || (exploration?.discovered.has(key) ?? true);
      const lighting = lightingFor(isKnown, key, exploration);
      return {
        pos,
        kind: tileKind(cell, exploration?.mined.has(key) ?? false),
        lighting,
        isLampLit: lighting === "dark" && isBeside(robot, pos),
        fringe: lighting === "dark" && exploration ? litNeighbourSides(pos, exploration) : [],
        hasRobot,
        isSealed: lighting === "dark" && exploration?.lit !== undefined,
      };
    }),
  );
}

function contentLabel(view: TileView, robot: RobotState | null): string {
  if (view.lighting === "dark") {
    return hu.mine.hidden;
  }
  if (view.hasRobot && robot) {
    const dir = dirNames[robot.dir];
    return view.kind === "gold" ? hu.mine.robotOnGold(dir) : hu.mine.robot(dir);
  }
  const content = view.kind === "mined" ? hu.mine.mined : cellNames[kindToCell(view.kind)];
  return view.lighting === "shrouded" ? hu.mine.unexplored(content) : content;
}

function kindToCell(kind: TileKind): Cell {
  if (kind === "wall" || kind === "gold") {
    return kind;
  }
  return "empty";
}

export function describeTile(view: TileView, robot: RobotState | null, note?: string): string {
  const content = contentLabel(view, robot);
  return hu.mine.cell(view.pos.row + 1, view.pos.col + 1, note ? `${content}, ${note}` : content);
}
