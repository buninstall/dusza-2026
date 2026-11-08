import type { SceneLayout } from "./layout.ts";
import type { LightField, Rgb } from "./light.ts";

export type SceneLighting = "open" | "lamp" | "dark" | "work";

export type Preset = {
  board: number;
  frame: number;
  rock: number;
  lanterns: number;
  bulbs: number;
  pilot: number;
  floods: number;
  ruler: number;
  memory: number;
  shroud: number;
  hidden: number;
  levels: number;
};

export const PRESETS: Readonly<Record<SceneLighting, Preset>> = {
  open: {
    board: 0.5,
    frame: 0.24,
    rock: 0.13,
    lanterns: 1.1,
    bulbs: 0.8,
    pilot: 0.85,
    floods: 0,
    ruler: 0,
    memory: 0,
    shroud: 0.55,
    hidden: 0.2,
    levels: 6,
  },
  lamp: {
    board: 0,
    frame: 0.1,
    rock: 0.07,
    lanterns: 0,
    bulbs: 0,
    pilot: 0.72,
    floods: 0,
    ruler: 0.55,
    memory: 0.56,
    shroud: 0.5,
    hidden: 0,
    levels: 6,
  },
  dark: {
    board: 0,
    frame: 0.05,
    rock: 0.035,
    lanterns: 0,
    bulbs: 0,
    pilot: 0.5,
    floods: 0,
    ruler: 0.42,
    memory: 0.38,
    shroud: 0.4,
    hidden: 0,
    levels: 5,
  },
  work: {
    board: 0.5,
    frame: 0.26,
    rock: 0.13,
    lanterns: 0.5,
    bulbs: 0.55,
    pilot: 0,
    floods: 0.85,
    ruler: 0,
    memory: 0,
    shroud: 0,
    hidden: 0.2,
    levels: 7,
  },
};

export const LANTERN_COLOR: Rgb = [1, 0.7, 0.4];
export const BULB_COLOR: Rgb = [1, 0.84, 0.58];
export const FLOOD_COLOR: Rgb = [1, 0.95, 0.84];
export const PILOT_COLOR: Rgb = [1, 0.58, 0.28];
export const LAMP_COLOR: Rgb = [1, 0.9, 0.68];
export const HALO_COLOR: Rgb = [1, 0.84, 0.62];
export const BURST_COLOR: Rgb = [1, 0.82, 0.4];

const VIGNETTE = 0.75;
const FRAME_SPILL = 6;

export function buildAmbient(layout: SceneLayout, field: LightField, preset: Preset): Float32Array {
  const ambient = new Float32Array(field.BW * field.BH);
  const cx = layout.bx + layout.bw / 2;
  const cy = layout.by + layout.bh / 2;
  const reach = Math.hypot(layout.bw / 2 + 160, layout.bh / 2 + 120);
  for (let by = 0; by < field.BH; by += 1) {
    for (let bx = 0; bx < field.BW; bx += 1) {
      const x = bx * 2 + 1;
      const y = by * 2 + 1;
      const inBoard =
        x >= layout.bx && x < layout.bx + layout.bw && y >= layout.by && y < layout.by + layout.bh;
      const inFrame =
        (x >= layout.postL - FRAME_SPILL &&
          x < layout.postR + 18 &&
          y >= layout.beamY &&
          y < layout.railY + 7) ||
        (x >= layout.postL - 64 &&
          x < layout.cart.x + 72 &&
          y >= layout.railY - 18 &&
          y < layout.groundY + 16);
      const vignette = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / reach) * VIGNETTE;
      ambient[by * field.BW + bx] = inBoard
        ? preset.board
        : inFrame
          ? preset.frame
          : preset.rock * vignette;
    }
  }
  return ambient;
}

export function flicker(t: number, seed: number, isStill: boolean): number {
  if (isStill) {
    return 0.9;
  }
  const dip = Math.sin(t * 2.3 + seed * 5) > 0.985 ? 0.55 : 1;
  return (0.84 + 0.09 * Math.sin(t * 11 + seed) + 0.07 * Math.sin(t * 29 + seed * 2.1)) * dip;
}

export function isBulbOut(t: number, isFaulty: boolean, isStill: boolean): boolean {
  return isFaulty && !isStill && Math.sin(t * 7.1) * Math.sin(t * 2.9) > 0.55;
}
