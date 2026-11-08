import type { MineMap, Pos, RobotState, RunResult } from "@minescript/engine";
import { z } from "zod";
import { posKey } from "../mine/tiles-model.ts";

export const LAMP_MODES = ["open", "lamp", "dark"] as const;
export type LampMode = (typeof LAMP_MODES)[number];

export const LAMP_MAX_RADIUS = 4;
const BASE_RADIUS: Record<Exclude<LampMode, "open">, number> = { lamp: 1, dark: 0 };
const STEPS: readonly { dRow: number; dCol: number }[] = [
  { dRow: -1, dCol: 0 },
  { dRow: 0, dCol: 1 },
  { dRow: 1, dCol: 0 },
  { dRow: 0, dCol: -1 },
];

export type Sketch = { discovered: ReadonlySet<string>; lit: ReadonlySet<string> };

export const EMPTY_SKETCH: Sketch = { discovered: new Set(), lit: new Set() };

export type LampTrack = { lit: readonly ReadonlySet<string>[]; radius: readonly number[] };

export function isDarkMine(mode: LampMode): mode is Exclude<LampMode, "open"> {
  return mode === "lamp" || mode === "dark";
}

export function lampRadius(mode: LampMode, gold: number): number {
  if (!isDarkMine(mode)) {
    return LAMP_MAX_RADIUS;
  }
  return Math.min(BASE_RADIUS[mode] + Math.max(gold, 0), LAMP_MAX_RADIUS);
}

function isInside(map: MineMap, pos: Pos): boolean {
  return pos.row >= 0 && pos.row < map.rows && pos.col >= 0 && pos.col < map.cols;
}

function isWall(map: MineMap, pos: Pos): boolean {
  return map.cells[pos.row]?.[pos.col] === "wall";
}

export function lampLight(map: MineMap, from: Pos, radius: number): Set<string> {
  const lit = new Set<string>([posKey(from)]);
  let ring: Pos[] = isWall(map, from) ? [] : [from];
  for (let distance = 1; distance <= radius && ring.length > 0; distance += 1) {
    const next: Pos[] = [];
    for (const pos of ring) {
      for (const { dRow, dCol } of STEPS) {
        const target = { row: pos.row + dRow, col: pos.col + dCol };
        const key = posKey(target);
        if (!isInside(map, target) || lit.has(key)) {
          continue;
        }
        lit.add(key);
        if (!isWall(map, target)) {
          next.push(target);
        }
      }
    }
    ring = next;
  }
  return lit;
}

export function lampTrack(
  map: MineMap,
  start: RobotState,
  result: RunResult,
  mode: LampMode,
): LampTrack {
  const startRadius = lampRadius(mode, 0);
  let lit: ReadonlySet<string> = lampLight(map, start.pos, startRadius);
  const litAt: ReadonlySet<string>[] = [lit];
  const radiusAt: number[] = [startRadius];
  for (const event of result.events) {
    const radius = lampRadius(mode, event.gold);
    const next = new Set(lit);
    for (const pos of [...event.path, event.robot.pos]) {
      for (const key of lampLight(map, pos, radius)) {
        next.add(key);
      }
    }
    lit = next;
    litAt.push(lit);
    radiusAt.push(radius);
  }
  return { lit: litAt, radius: radiusAt };
}

export function isLampBroken(result: RunResult): boolean {
  return result.outcome.kind === "runtimeError" && result.outcome.code === "E_BEDROCK_HIT";
}

function union(...sets: ReadonlySet<string>[]): Set<string> {
  const merged = new Set<string>();
  for (const set of sets) {
    for (const key of set) {
      merged.add(key);
    }
  }
  return merged;
}

export function sketchAfterRun(
  sketch: Sketch,
  start: RobotState,
  result: RunResult,
  track: LampTrack,
): Sketch {
  if (isLampBroken(result)) {
    return EMPTY_SKETCH;
  }
  const walked = new Set([posKey(start.pos), ...result.discovered.map(posKey)]);
  return {
    discovered: union(sketch.discovered, walked),
    lit: union(sketch.lit, track.lit.at(-1) ?? new Set()),
  };
}

export type LampView = {
  discovered: ReadonlySet<string>;
  lit: ReadonlySet<string>;
  radius: number;
  isBroken: boolean;
};

export type LampViewInput = {
  map: MineMap;
  start: RobotState;
  mode: LampMode;
  sketch: Sketch;
  frame: {
    index: number;
    discovered: ReadonlySet<string>;
    robot: RobotState;
    atEnd: boolean;
  } | null;
  track: LampTrack | null;
  isBroken: boolean;
};

export function lampView(input: LampViewInput): LampView {
  const { map, start, mode, sketch, frame, track } = input;
  if (frame === null || track === null) {
    const radius = lampRadius(mode, 0);
    return {
      discovered: union(sketch.discovered, new Set([posKey(start.pos)])),
      lit: union(sketch.lit, lampLight(map, start.pos, radius)),
      radius,
      isBroken: false,
    };
  }
  if (input.isBroken && frame.atEnd) {
    return {
      discovered: union(frame.discovered, new Set([posKey(frame.robot.pos)])),
      lit: new Set(),
      radius: 0,
      isBroken: true,
    };
  }
  const index = Math.min(frame.index, track.lit.length - 1);
  return {
    discovered: union(sketch.discovered, frame.discovered),
    lit: union(sketch.lit, track.lit[index] ?? new Set()),
    radius: track.radius[index] ?? lampRadius(mode, 0),
    isBroken: false,
  };
}

const storedSketchSchema = z.object({
  discovered: z.array(z.string().regex(/^\d{1,2}:\d{1,2}$/)).max(225),
  lit: z.array(z.string().regex(/^\d{1,2}:\d{1,2}$/)).max(225),
});

export function encodeSketch(sketch: Sketch): string {
  return JSON.stringify({ discovered: [...sketch.discovered], lit: [...sketch.lit] });
}

export function decodeSketch(stored: string | null): Sketch {
  if (stored === null) {
    return EMPTY_SKETCH;
  }
  try {
    const parsed = storedSketchSchema.safeParse(JSON.parse(stored));
    return parsed.success
      ? { discovered: new Set(parsed.data.discovered), lit: new Set(parsed.data.lit) }
      : EMPTY_SKETCH;
  } catch {
    return EMPTY_SKETCH;
  }
}

export function sketchKey(userId: number, mapVersionId: number): string {
  return `minescript.lamp-sketch.${userId}.${mapVersionId}`;
}
