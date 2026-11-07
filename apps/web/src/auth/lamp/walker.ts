import { type Cell, seeded } from "./mine.ts";

const DIR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI] as const;
const DIRS: readonly Cell[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const TURN_PAUSE = 0.16;
const SWEEP_PAUSE = 1.7;
const SWEEP_SWING = 0.95;
const LAMP_FOLLOW = 9;

export const MINE_TIME = 1.1;
export const MINE_HIT = 0.45;

export type Mining = { c: number; r: number; t: number; hasHit: boolean };

export type WalkerState = {
  x: number;
  y: number;
  dir: number;
  lamp: number;
  travel: number;
  mining: Mining | null;
};

export type WalkerOptions = {
  speed: number;
  seed: number;
  sweepChance: number;
  isGold: (c: number, r: number) => boolean;
  isJunction: (c: number, r: number) => boolean;
  onMine: (c: number, r: number) => void;
  onLoop: () => void;
};

type Pause = { kind: "turn" | "sweep" | "mine"; left: number; length: number };

function dirIndex(dc: number, dr: number): number {
  return DIRS.findIndex(([c, r]) => c === dc && r === dr);
}

function lerpAngle(from: number, to: number, t: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}

export function createWalker(legs: readonly Cell[][], options: WalkerOptions) {
  const rand = seeded(options.seed);
  const first = legs[0]?.[0] ?? [0, 0];
  const state: WalkerState = {
    x: first[0],
    y: first[1],
    dir: 1,
    lamp: 0,
    travel: 0,
    mining: null,
  };
  let leg = 0;
  let index = 0;
  let progress = 0;
  let sweep = 0;
  let pause: Pause | null = null;

  const arrive = (c: number, r: number) => {
    state.x = c;
    state.y = r;
    if (options.isGold(c, r)) {
      state.mining = { c, r, t: 0, hasHit: false };
      pause = { kind: "mine", left: MINE_TIME, length: MINE_TIME };
    } else if (options.isJunction(c, r) && rand() < options.sweepChance) {
      pause = { kind: "sweep", left: SWEEP_PAUSE, length: SWEEP_PAUSE };
    }
  };

  const advance = (dt: number) => {
    const path = legs[leg];
    if (!path) return;
    if (index >= path.length - 1) {
      leg = (leg + 1) % legs.length;
      index = 0;
      if (leg === 0) options.onLoop();
      return;
    }
    const from = path[index];
    const to = path[index + 1];
    if (!from || !to) return;
    const dir = dirIndex(to[0] - from[0], to[1] - from[1]);
    if (dir !== state.dir && dir >= 0) {
      state.dir = dir;
      pause = { kind: "turn", left: TURN_PAUSE, length: TURN_PAUSE };
      return;
    }
    progress += dt * options.speed;
    state.travel += dt * options.speed;
    if (progress >= 1) {
      progress = 0;
      index += 1;
      arrive(to[0], to[1]);
      return;
    }
    state.x = from[0] + (to[0] - from[0]) * progress;
    state.y = from[1] + (to[1] - from[1]) * progress;
  };

  const hold = (current: Pause, dt: number) => {
    current.left -= dt;
    const phase = 1 - current.left / current.length;
    if (current.kind === "sweep") sweep = Math.sin(phase * Math.PI * 2) * SWEEP_SWING;
    const mining = state.mining;
    if (current.kind === "mine" && mining) {
      mining.t += dt;
      if (!mining.hasHit && mining.t >= MINE_HIT) {
        mining.hasHit = true;
        options.onMine(mining.c, mining.r);
      }
    }
    if (current.left <= 0) {
      sweep = 0;
      state.mining = null;
      pause = null;
    }
  };

  const update = (dt: number) => {
    if (pause) hold(pause, dt);
    else advance(dt);
    const target = (DIR_ANGLE[state.dir] ?? 0) + sweep;
    state.lamp = lerpAngle(state.lamp, target, 1 - Math.exp(-dt * LAMP_FOLLOW));
  };

  return { state, update };
}
