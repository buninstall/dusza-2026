import type { Dir, MineMap, Pos, RunResult } from "@minescript/engine";

export type Fault =
  | { kind: "wall"; pos: Pos }
  | { kind: "edge"; pos: Pos; side: Dir }
  | { kind: "noGold"; pos: Pos }
  | { kind: "logic" };

const AHEAD: Record<Dir, Pos> = {
  north: { row: -1, col: 0 },
  east: { row: 0, col: 1 },
  south: { row: 1, col: 0 },
  west: { row: 0, col: -1 },
};

function isInside(map: MineMap, pos: Pos): boolean {
  return pos.row >= 0 && pos.row < map.rows && pos.col >= 0 && pos.col < map.cols;
}

export function aheadOf(pos: Pos, dir: Dir): Pos {
  const delta = AHEAD[dir];
  return { row: pos.row + delta.row, col: pos.col + delta.col };
}

export function isOffMapHit(result: RunResult | null, map: MineMap): boolean {
  return result !== null && deriveFault(result, map)?.kind === "edge";
}

export function deriveFault(result: RunResult, map: MineMap): Fault | null {
  const { outcome } = result;
  if (outcome.kind !== "runtimeError") {
    return null;
  }
  const robot = result.finalRobot;
  if (outcome.code === "E_BEDROCK_HIT") {
    const target = aheadOf(robot.pos, robot.dir);
    return isInside(map, target)
      ? { kind: "wall", pos: target }
      : { kind: "edge", pos: robot.pos, side: robot.dir };
  }
  if (outcome.code === "E_NO_GOLD") {
    return { kind: "noGold", pos: robot.pos };
  }
  return { kind: "logic" };
}
