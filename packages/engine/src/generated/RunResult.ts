import type { Event } from "./Event";
import type { Outcome } from "./Outcome";
import type { Pos } from "./Pos";
import type { RobotState } from "./RobotState";

export type RunResult = {
  outcome: Outcome;
  events: Array<Event>;
  gold: number;
  steps: number;
  console: Array<string>;
  finalRobot: RobotState;
  discovered: Array<Pos>;
};
