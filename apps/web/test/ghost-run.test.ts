import type { Event, RobotState, RunResult } from "@minescript/engine";
import { describe, expect, test } from "vitest";
import { ghostOf } from "../src/play/ghost-run.ts";

const START: RobotState = { pos: { row: 3, col: 0 }, dir: "north" } as RobotState;

function event(partial: Partial<Event>): Event {
  return {
    index: 0,
    line: 1,
    robot: START,
    path: [],
    discovered: [],
    mined: null,
    gold: 0,
    steps: 0,
    print: null,
    assigned: null,
    ...partial,
  } as Event;
}

function result(partial: Partial<RunResult>): RunResult {
  return {
    outcome: { kind: "ok" },
    events: [],
    gold: 0,
    steps: 0,
    console: [],
    finalRobot: START,
    discovered: [],
    ...partial,
  } as RunResult;
}

describe("élő útvonal-előnézet", () => {
  test("a lépések útvonala ismétlés nélkül, a bányászott arannyal együtt", () => {
    const moved = { pos: { row: 1, col: 0 }, dir: "north" } as RobotState;
    const ghost = ghostOf(
      result({
        events: [
          event({
            path: [
              { row: 2, col: 0 },
              { row: 1, col: 0 },
            ],
            robot: moved,
          }),
          event({ robot: moved, mined: { row: 1, col: 0 }, gold: 1 }),
        ],
        gold: 1,
        steps: 2,
        finalRobot: moved,
      }),
      START,
    );
    expect(ghost?.path).toEqual([
      { row: 3, col: 0 },
      { row: 2, col: 0 },
      { row: 1, col: 0 },
    ]);
    expect(ghost?.mined).toEqual([{ row: 1, col: 0 }]);
    expect(ghost?.end).toEqual({ row: 1, col: 0 });
    expect(ghost?.isError).toBe(false);
    expect(ghost?.gold).toBe(1);
    expect(ghost?.steps).toBe(2);
  });

  test("futási hibánál a hiba sorát is megadja", () => {
    const ghost = ghostOf(
      result({
        outcome: { kind: "runtimeError", code: "E_BEDROCK_HIT", line: 4, message: "" },
      } as Partial<RunResult>),
      START,
    );
    expect(ghost?.isError).toBe(true);
    expect(ghost?.errorLine).toBe(4);
  });

  test("szintaktikai hibás programhoz nincs előnézet", () => {
    expect(
      ghostOf(result({ outcome: { kind: "syntaxError", diagnostics: [] } }), START),
    ).toBeNull();
  });
});
