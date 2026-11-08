import type { Event, Pos, RobotState, RunResult, Value } from "@minescript/engine";
import { posKey } from "../mine/tiles-model.ts";

export type ConsoleEntry = { index: number; step: number; text: string };

export type Frame = {
  index: number;
  total: number;
  robot: RobotState;
  event: Event | null;
  discovered: ReadonlySet<string>;
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

type Cursor = {
  result: RunResult;
  start: RobotState;
  index: number;
  discovered: Set<string>;
  mined: Set<string>;
  console: ConsoleEntry[];
  variables: Map<string, Value>;
  fresh: Set<string>;
  robot: RobotState;
  gold: number;
  steps: number;
  line: number | null;
  lastMined: Pos | null;
};

let cursor: Cursor | null = null;

function openCursor(result: RunResult, start: RobotState): Cursor {
  return {
    result,
    start,
    index: 0,
    discovered: new Set<string>([posKey(start.pos)]),
    mined: new Set<string>(),
    console: [],
    variables: new Map<string, Value>(),
    fresh: new Set<string>(),
    robot: start,
    gold: 0,
    steps: 0,
    line: null,
    lastMined: null,
  };
}

function applyEvent(state: Cursor, event: Event, position: number): void {
  state.robot = event.robot;
  state.gold = event.gold;
  state.steps = event.steps;
  state.line = event.line;
  state.lastMined = event.mined;
  const keys = eventTiles(event).map(posKey);
  state.fresh = new Set(keys.filter((key) => !state.discovered.has(key)));
  for (const key of keys) {
    state.discovered.add(key);
  }
  if (event.mined) {
    state.mined.add(posKey(event.mined));
  }
  if (event.print !== null) {
    state.console.push({ index: position + 1, step: event.steps, text: event.print });
  }
  if (event.assigned) {
    state.variables.set(event.assigned.name, event.assigned.value);
  }
}

function cursorAt(result: RunResult, start: RobotState, index: number): Cursor {
  const reusable =
    cursor !== null && cursor.result === result && cursor.start === start && cursor.index <= index;
  const state = reusable && cursor ? cursor : openCursor(result, start);
  for (let position = state.index; position < index; position += 1) {
    const event = result.events[position];
    if (event) {
      applyEvent(state, event, position);
    }
  }
  state.index = index;
  cursor = state;
  return state;
}

export function deriveFrame(result: RunResult, start: RobotState, requestedIndex: number): Frame {
  const index = clampIndex(result, requestedIndex);
  const state = cursorAt(result, start, index);
  const event = index > 0 ? (result.events[index - 1] ?? null) : null;
  return {
    index,
    total: result.events.length,
    robot: state.robot,
    event,
    discovered: new Set(state.discovered),
    fresh: new Set(state.fresh),
    mined: new Set(state.mined),
    scan: event ? scannedTile(event) : null,
    gold: state.gold,
    steps: state.steps,
    console: [...state.console],
    variables: new Map(state.variables),
    changedVar: event?.assigned?.name ?? null,
    line: state.line,
    lastMined: state.lastMined,
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
