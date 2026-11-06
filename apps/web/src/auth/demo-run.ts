import type { Event, MineMap, Pos, RobotState, RunResult } from "@minescript/engine";

const W = "wall" as const;
const E = "empty" as const;
const G = "gold" as const;

export const DEMO_MAP: MineMap = {
  rows: 5,
  cols: 9,
  cells: [
    [W, W, W, W, W, W, W, W, W],
    [W, E, E, E, G, E, E, E, W],
    [W, W, W, W, E, W, W, E, W],
    [W, G, E, E, G, W, E, E, W],
    [W, W, W, W, W, W, W, W, W],
  ],
  robot: { row: 1, col: 1 },
  dir: "east",
};

export const DEMO_START: RobotState = { pos: DEMO_MAP.robot, dir: DEMO_MAP.dir };

export const DEMO_PROGRAM: readonly string[] = [
  "step forward 3",
  "mine here",
  "turn by 3",
  "step forward 2",
  "mine here",
  "turn by 3",
  "set fal to isThere 1",
  "step forward 3",
  "mine here",
  "print fal",
];

const at = (row: number, col: number): Pos => ({ row, col });

type Step = Partial<Omit<Event, "index" | "line" | "steps">>;

const STEPS: readonly Step[] = [
  {
    robot: { pos: at(1, 4), dir: "east" },
    path: [at(1, 2), at(1, 3), at(1, 4)],
    discovered: [at(1, 2), at(1, 3), at(1, 4)],
  },
  { mined: at(1, 4), gold: 1 },
  { robot: { pos: at(1, 4), dir: "south" } },
  {
    robot: { pos: at(3, 4), dir: "south" },
    path: [at(2, 4), at(3, 4)],
    discovered: [at(2, 4), at(3, 4)],
  },
  { mined: at(3, 4), gold: 2 },
  { robot: { pos: at(3, 4), dir: "west" } },
  { discovered: [at(3, 3)], assigned: { name: "fal", value: { kind: "bool", value: false } } },
  {
    robot: { pos: at(3, 1), dir: "west" },
    path: [at(3, 3), at(3, 2), at(3, 1)],
    discovered: [at(3, 2), at(3, 1)],
  },
  { mined: at(3, 1), gold: 3 },
  { print: "false" },
];

function buildEvents(): Event[] {
  let robot = DEMO_START;
  let gold = 0;
  return STEPS.map((step, index) => {
    robot = step.robot ?? robot;
    gold = step.gold ?? gold;
    return {
      index,
      line: index + 1,
      steps: index + 1,
      robot,
      path: step.path ?? [],
      discovered: step.discovered ?? [],
      mined: step.mined ?? null,
      gold,
      print: step.print ?? null,
      assigned: step.assigned ?? null,
    };
  });
}

const events = buildEvents();

export const DEMO_RUN: RunResult = {
  outcome: { kind: "ok" },
  events,
  gold: 3,
  steps: events.length,
  console: ["false"],
  finalRobot: events.at(-1)?.robot ?? DEMO_START,
  discovered: [DEMO_START.pos, ...events.flatMap((event) => event.discovered)],
};
