import type { Pos, RobotState, RunResult, Value } from "@minescript/engine";
import { posKey } from "../mine/tiles-model.ts";

export type ConsoleEntry = { step: number; text: string };

export type Frame = {
  index: number;
  total: number;
  robot: RobotState;
  discovered: ReadonlySet<string>;
  mined: ReadonlySet<string>;
  gold: number;
  steps: number;
  console: readonly ConsoleEntry[];
  variables: ReadonlyMap<string, Value>;
  line: number | null;
  lastMined: Pos | null;
  atStart: boolean;
  atEnd: boolean;
};

export function clampIndex(result: RunResult, index: number): number {
  return Math.min(Math.max(Math.trunc(index), 0), result.events.length);
}

export function deriveFrame(result: RunResult, start: RobotState, requestedIndex: number): Frame {
  const index = clampIndex(result, requestedIndex);
  const discovered = new Set<string>([posKey(start.pos)]);
  const mined = new Set<string>();
  const consoleLines: ConsoleEntry[] = [];
  const variables = new Map<string, Value>();
  let robot = start;
  let gold = 0;
  let steps = 0;
  let line: number | null = null;
  let lastMined: Pos | null = null;

  for (const event of result.events.slice(0, index)) {
    robot = event.robot;
    gold = event.gold;
    steps = event.steps;
    line = event.line;
    lastMined = event.mined;
    for (const pos of [...event.path, ...event.discovered, event.robot.pos]) {
      discovered.add(posKey(pos));
    }
    if (event.mined) {
      mined.add(posKey(event.mined));
    }
    if (event.print !== null) {
      consoleLines.push({ step: event.steps, text: event.print });
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
    lastMined,
    atStart: index === 0,
    atEnd: index === result.events.length,
  };
}

export function formatValue(value: Value): string {
  if (value.kind === "int") {
    return String(value.value);
  }
  return value.value ? "true" : "false";
}
