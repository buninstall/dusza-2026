import type { Event, MineMap, RobotState, RunResult } from "@minescript/engine";

export const tinyMap: MineMap = {
  rows: 2,
  cols: 3,
  cells: [
    ["empty", "gold", "wall"],
    ["empty", "empty", "gold"],
  ],
  robot: { row: 0, col: 0 },
  dir: "east",
};

export const start: RobotState = { pos: { row: 0, col: 0 }, dir: "east" };

function event(partial: Partial<Event> & Pick<Event, "index" | "line" | "steps">): Event {
  return {
    robot: start,
    path: [],
    discovered: [],
    mined: null,
    gold: 0,
    print: null,
    assigned: null,
    ...partial,
  };
}

export const syntheticTrace: RunResult = {
  outcome: { kind: "ok" },
  gold: 1,
  steps: 4,
  console: ["true"],
  finalRobot: { pos: { row: 0, col: 1 }, dir: "east" },
  discovered: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ],
  events: [
    event({
      index: 0,
      line: 1,
      steps: 1,
      discovered: [{ row: 0, col: 1 }],
      assigned: { name: "arany", value: { kind: "bool", value: true } },
    }),
    event({ index: 1, line: 2, steps: 2, print: "true" }),
    event({
      index: 2,
      line: 3,
      steps: 3,
      robot: { pos: { row: 0, col: 1 }, dir: "east" },
      path: [{ row: 0, col: 1 }],
    }),
    event({
      index: 3,
      line: 4,
      steps: 4,
      robot: { pos: { row: 0, col: 1 }, dir: "east" },
      mined: { row: 0, col: 1 },
      gold: 1,
    }),
  ],
};
