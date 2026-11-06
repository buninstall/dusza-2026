import type { Pos, RobotState, RunResult, Value } from "@minescript/engine";
import { posKey } from "../map/cells.ts";

export type Frame = {
  index: number;
  total: number;
  robot: RobotState;
  discovered: ReadonlySet<string>;
  mined: ReadonlySet<string>;
  gold: number;
  steps: number;
  console: readonly string[];
  variables: ReadonlyMap<string, Value>;
  line: number | null;
  atStart: boolean;
  atEnd: boolean;
};

export function clampIndex(result: RunResult, index: number): number {
  return Math.min(Math.max(Math.trunc(index), 0), result.events.length);
}

function addAll(target: Set<string>, positions: readonly Pos[]): void {
  for (const pos of positions) {
    target.add(posKey(pos));
  }
}

export function deriveFrame(result: RunResult, start: RobotState, requestedIndex: number): Frame {
  const index = clampIndex(result, requestedIndex);
  const discovered = new Set<string>([posKey(start.pos)]);
  const mined = new Set<string>();
  const consoleLines: string[] = [];
  const variables = new Map<string, Value>();
  let robot = start;
  let gold = 0;
  let steps = 0;
  let line: number | null = null;

  for (const event of result.events.slice(0, index)) {
    robot = event.robot;
    gold = event.gold;
    steps = event.steps;
    line = event.line;
    addAll(discovered, event.path);
    addAll(discovered, event.discovered);
    discovered.add(posKey(event.robot.pos));
    if (event.mined) {
      mined.add(posKey(event.mined));
    }
    if (event.print !== null) {
      consoleLines.push(event.print);
    }
    if (event.assigned) {
      variables.set(event.assigned.name, event.assigned.value);
    }
  }

  return {
    index,
    total: result.events.length,
    robot,
    discovered,
    mined,
    gold,
    steps,
    console: consoleLines,
    variables,
    line,
    atStart: index === 0,
    atEnd: index === result.events.length,
  };
}

export function formatValue(value: Value): string {
  return value.kind === "int" ? String(value.value) : value.value ? "true" : "false";
}
