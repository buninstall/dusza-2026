import type { Assignment } from "./Assignment";
import type { Pos } from "./Pos";
import type { RobotState } from "./RobotState";

export type Event = {
  index: number;
  line: number;
  robot: RobotState;
  path: Array<Pos>;
  discovered: Array<Pos>;
  mined: Pos | null;
  gold: number;
  steps: number;
  print: string | null;
  assigned: Assignment | null;
};
