import type { View } from "./camera.ts";
import { T } from "./layout.ts";
import { bayer, type LightField, type Rgb } from "./light.ts";
import { SIGHT_HIDDEN, SIGHT_SHROUD } from "./paint-board.ts";

const MEMORY_TINT: Rgb = [0.42, 0.47, 0.64];
const SHROUD_TINT: Rgb = [0.78, 0.8, 0.92];
const MAX_LEVEL = 1.4;
const HAZE_SHARE = 0.32;

export type World = {
  W: number;
  H: number;
  albedo: Uint8ClampedArray;
  face: Uint8Array;
  ambient: Float32Array;
};

export type BoardSight = {
  bx: number;
  by: number;
  cols: number;
  rows: number;
  sight: Uint8Array;
};

export type ShadeLook = {
  levels: number;
  memory: number;
  shroud: number;
  base: Rgb;
  haze: Rgb;
};

const FACE_LIGHT = [1, 1.12, 0.5, 0.58];

function sightAt(board: BoardSight, wx: number, wy: number): number {
  const c = Math.floor((wx - board.bx) / T);
  const r = Math.floor((wy - board.by) / T);
  if (c < 0 || r < 0 || c >= board.cols || r >= board.rows) {
    return -1;
  }
  return board.sight[r * board.cols + c] ?? -1;
}

function isVeilCell(wx: number, wy: number): boolean {
  return ((wx >> 1) + (wy >> 1)) % 2 === 0;
}

export function shadeView(
  out: Uint8ClampedArray,
  view: View,
  world: World,
  light: LightField,
  board: BoardSight,
  look: ShadeLook,
): void {
  const { W, H, albedo, face, ambient } = world;
  const { rgb, beam, BW } = light;
  for (let y = 0; y < view.height; y += 1) {
    const wy = view.y + y;
    for (let x = 0; x < view.width; x += 1) {
      const wx = view.x + x;
      const o = (y * view.width + x) * 4;
      out[o + 3] = 255;
      if (wx < 0 || wy < 0 || wx >= W || wy >= H) {
        out[o] = look.base[0];
        out[o + 1] = look.base[1];
        out[o + 2] = look.base[2];
        continue;
      }
      const i = (wy * W + wx) * 4;
      const block = (wy >> 1) * BW + (wx >> 1);
      const k = block * 3;
      const sight = sightAt(board, wx, wy);
      if (sight === SIGHT_HIDDEN) {
        out[o] = look.base[0];
        out[o + 1] = look.base[1];
        out[o + 2] = look.base[2];
        continue;
      }
      const amb = ambient[block] ?? 0;
      const mul = FACE_LIGHT[face[wy * W + wx] ?? 0] ?? 1;
      const lr = ((rgb[k] ?? 0) + amb) * mul;
      const lg = ((rgb[k + 1] ?? 0) + amb * 0.86) * mul;
      const lb = ((rgb[k + 2] ?? 0) + amb * 0.72) * mul;
      const lum = Math.max(lr, lg, lb);
      const threshold = bayer(wx, wy);
      const q = Math.min(MAX_LEVEL, Math.floor(lum * look.levels + threshold) / look.levels);
      let r = look.base[0];
      let g = look.base[1];
      let b = look.base[2];
      if (q > 0) {
        const s = q / lum;
        r = Math.max(r, (albedo[i] ?? 0) * lr * s);
        g = Math.max(g, (albedo[i + 1] ?? 0) * lg * s);
        b = Math.max(b, (albedo[i + 2] ?? 0) * lb * s);
      } else if (sight !== -1 && look.memory > 0 && threshold < 0.55) {
        r = Math.max(r, (albedo[i] ?? 0) * MEMORY_TINT[0] * look.memory);
        g = Math.max(g, (albedo[i + 1] ?? 0) * MEMORY_TINT[1] * look.memory);
        b = Math.max(b, (albedo[i + 2] ?? 0) * MEMORY_TINT[2] * look.memory);
      }
      const haze = beam[block] ?? 0;
      if (haze > 0.05 && q < 0.5 && haze * HAZE_SHARE > bayer(wx + 2, wy + 1)) {
        r = Math.max(r, look.haze[0] * 0.16);
        g = Math.max(g, look.haze[1] * 0.13);
        b = Math.max(b, look.haze[2] * 0.09);
      }
      if (sight === SIGHT_SHROUD && isVeilCell(wx, wy)) {
        r = Math.max(look.base[0], r * SHROUD_TINT[0] * look.shroud);
        g = Math.max(look.base[1], g * SHROUD_TINT[1] * look.shroud);
        b = Math.max(look.base[2], b * SHROUD_TINT[2] * look.shroud);
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
    }
  }
}
