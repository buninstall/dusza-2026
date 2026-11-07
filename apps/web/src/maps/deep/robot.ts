import type { Level } from "./build.ts";
import type { Face } from "./sprites.ts";
import { easeInOut, type Vein } from "./world.ts";

type Task =
  | { kind: "lift"; to: Level; t: number; dur: number; from: number; dest: number }
  | { kind: "drive"; to: number; t: number; dur: number; from: number }
  | { kind: "mine"; vein: Vein; t: number; dur: number; hasHit: boolean }
  | { kind: "sweep"; t: number; dur: number }
  | { kind: "wait"; t: number; dur: number };

export type Robot = {
  x: number;
  y: number;
  face: Face;
  travel: number;
  sweep: number;
  isInCage: boolean;
  mining: Vein | null;
  miningPhase: number;
  cageY: number;
  cageSpeed: number;
  goal: Level | null;
};

export type RobotOptions = {
  shaftX: number;
  surfaceY: number;
  driveSpeed: number;
  levels: readonly Level[];
  onHit: (vein: Vein, level: Level) => void;
};

const LIFT_SPEED = 75;
const LIFT_LEAD = 0.7;

export function standY(level: Level): number {
  return level.rail - 13;
}

export function createRobot(options: RobotOptions) {
  const { shaftX, levels } = options;
  const robot: Robot = {
    x: shaftX,
    y: options.surfaceY,
    face: "right",
    travel: 0,
    sweep: 0,
    isInCage: true,
    mining: null,
    miningPhase: 0,
    cageY: options.surfaceY,
    cageSpeed: 0,
    goal: null,
  };
  let queue: Task[] = [];
  let task: Task | null = null;
  let tour = 0;
  let wanted: Level | null = null;

  const plan = (level: Level) => {
    robot.goal = level;
    queue = [];
    if (!robot.isInCage) queue.push({ kind: "drive", to: shaftX, t: 0, dur: 0, from: 0 });
    queue.push({ kind: "lift", to: level, t: 0, dur: 0, from: 0, dest: 0 });
    queue.push({ kind: "drive", to: level.stopX, t: 0, dur: 0, from: 0 });
    const open = level.veins.filter((v) => !v.isMined);
    for (const v of open) queue.push({ kind: "mine", vein: v, t: 0, dur: 1.5, hasHit: false });
    if (open.length === 0) queue.push({ kind: "sweep", t: 0, dur: 1.9 });
    queue.push({ kind: "wait", t: 0, dur: 0.5 });
    queue.push({ kind: "drive", to: shaftX, t: 0, dur: 0, from: 0 });
  };

  const next = () => {
    if (wanted && !wanted.isDigging) {
      plan(wanted);
      return;
    }
    const ready = levels.filter((l) => !l.isDigging);
    const level = ready[tour % Math.max(1, ready.length)];
    tour += 1;
    if (level) plan(level);
  };

  const begin = () => {
    task = queue.shift() ?? null;
    if (!task) return;
    task.t = 0;
    if (task.kind === "lift") {
      task.from = robot.cageY;
      task.dest = standY(task.to);
      task.dur = LIFT_LEAD + Math.abs(task.dest - task.from) / LIFT_SPEED;
    } else if (task.kind === "drive") {
      task.from = robot.x;
      task.dur = Math.max(0.05, Math.abs(task.to - robot.x) / options.driveSpeed);
    }
  };

  const step = (current: Task, dt: number) => {
    const u = Math.min(1, current.t / current.dur);
    if (current.kind === "lift") {
      const y = current.from + (current.dest - current.from) * easeInOut(u);
      robot.cageSpeed = (y - robot.cageY) / dt;
      robot.cageY = y;
      robot.y = y;
      robot.x = shaftX;
    } else if (current.kind === "drive") {
      const nx = current.from + (current.to - current.from) * easeInOut(u);
      robot.travel += Math.abs(nx - robot.x);
      robot.face = current.to >= current.from ? "right" : "left";
      robot.x = nx;
      robot.isInCage = Math.abs(robot.x - shaftX) < 2;
      robot.cageSpeed = 0;
    } else if (current.kind === "mine") {
      robot.face = "right";
      robot.mining = current.vein;
      robot.miningPhase = u;
      if (!current.hasHit && u > 0.4 && robot.goal) {
        current.hasHit = true;
        options.onHit(current.vein, robot.goal);
      }
    } else if (current.kind === "sweep") {
      robot.sweep = Math.sin(u * Math.PI * 2) * 0.5;
    }
  };

  const update = (dt: number) => {
    robot.mining = null;
    robot.sweep = 0;
    if (!task) {
      if (queue.length === 0) next();
      begin();
      return;
    }
    task.t += dt;
    const isInterruptible = task.kind === "drive" || task.kind === "wait" || task.kind === "sweep";
    if (wanted && wanted !== robot.goal && !wanted.isDigging && isInterruptible) {
      plan(wanted);
      begin();
      return;
    }
    step(task, dt);
    if (task.t >= task.dur) {
      if (task.kind === "lift") robot.cageSpeed = 0;
      task = null;
    }
  };

  const setWanted = (level: Level | null) => {
    wanted = level;
  };

  return { robot, update, setWanted };
}
