import type { Event, Pos, RobotState, RunResult, Value } from "@minescript/engine";
import { posKey } from "../mine/tiles-model.ts";

export type ConsoleEntry = { index: number; step: number; text: string };

export type Frame = {
  index: number;
  total: number;
  robot: RobotState;
  event: Event | null;
  discovered: ReadonlySet<string>;
  walked: ReadonlySet<string>;
  fresh: ReadonlySet<string>;
  mined: ReadonlySet<string>;
  scan: Pos | null;
  gold: number;
  steps: number;
  console: readonly ConsoleEntry[];
  variables: ReadonlyMap<string, Value>;
  changedVar: string | null;
  line: number | null;
  lastMined: Pos | null;
  atStart: boolean;
  atEnd: boolean;
};

export type TimelineMark = { index: number; kind: "gold" | "print" };

export function clampIndex(result: RunResult, index: number): number {
  return Math.min(Math.max(Math.trunc(index), 0), result.events.length);
}

function scannedTile(event: Event): Pos | null {
  const walked = new Set([...event.path, event.robot.pos].map(posKey));
  return event.discovered.find((pos) => !walked.has(posKey(pos))) ?? null;
}

function eventTiles(event: Event): Pos[] {
  return [...event.path, ...event.discovered, event.robot.pos];
}

export function deriveFrame(result: RunResult, start: RobotState, requestedIndex: number): Frame {
  const index = clampIndex(result, requestedIndex);
  const discovered = new Set<string>([posKey(start.pos)]);
  const walked = new Set<string>([posKey(start.pos)]);
  const mined = new Set<string>();
  const consoleLines: ConsoleEntry[] = [];
  const variables = new Map<string, Value>();
  const applied = result.events.slice(0, index);
  let fresh = new Set<string>();
  let robot = start;
  let gold = 0;
  let steps = 0;
  let line: number | null = null;
  let lastMined: Pos | null = null;

  applied.forEach((event, position) => {
    robot = event.robot;
    gold = event.gold;
    steps = event.steps;
    line = event.line;
    lastMined = event.mined;
    for (const pos of [...event.path, event.robot.pos]) {
      walked.add(posKey(pos));
    }
    const keys = eventTiles(event).map(posKey);
    fresh = new Set(keys.filter((key) => !discovered.has(key)));
    for (const key of keys) {
      discovered.add(key);
    }
    if (event.mined) {
      mined.add(posKey(event.mined));
    }
    if (event.print !== null) {
      consoleLines.push({ index: position + 1, step: event.steps, text: event.print });
    }
    if (event.assigned) {
      variables.set(event.assigned.name, event.assigned.value);
    }
  });

  const event = applied.at(-1) ?? null;
  return {
    index,
    total: result.events.length,
    robot,
    event,
    discovered,
    walked,
    fresh,
    mined,
    scan: event ? scannedTile(event) : null,
    gold,
    steps,
    console: consoleLines,
    variables,
    changedVar: event?.assigned?.name ?? null,
    line,
    lastMined,
    atStart: index === 0,
    atEnd: index === result.events.length,
  };
}

export function timelineMarks(result: RunResult): TimelineMark[] {
  return result.events.flatMap((event, position): TimelineMark[] => {
    const marks: TimelineMark[] = [];
    if (event.mined) {
      marks.push({ index: position + 1, kind: "gold" });
    }
    if (event.print !== null) {
      marks.push({ index: position + 1, kind: "print" });
    }
    return marks;
  });
}

export function formatValue(value: Value): string {
  if (value.kind === "int") {
    return String(value.value);
  }
  return value.value ? "true" : "false";
}
