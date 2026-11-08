import type { View } from "./camera.ts";
import { T } from "./layout.ts";
import { BAYER, type LightField, type Rgb } from "./light.ts";
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
  hidden: number;
  base: Rgb;
  haze: Rgb;
};

const FACE_LIGHT = Float32Array.from([1, 1.12, 0.5, 0.58]);
const TILE_SHIFT = 4;

export type ViewRect = { x0: number; y0: number; x1: number; y1: number };

export function shadeView(
  out: Uint8ClampedArray,
  view: View,
  world: World,
  light: LightField,
  board: BoardSight,
  look: ShadeLook,
  rect: ViewRect = { x0: 0, y0: 0, x1: view.width, y1: view.height },
): void {
  const { W, H, albedo, face, ambient } = world;
  const { rgb, beam, BW } = light;
  const { bx, by, cols, rows, sight: sights } = board;
  const [baseR, baseG, baseB] = look.base;
  const [hazeR, hazeG, hazeB] = look.haze;
  const { levels, memory, shroud, hidden } = look;
  const memR = MEMORY_TINT[0] * memory;
  const memG = MEMORY_TINT[1] * memory;
  const memB = MEMORY_TINT[2] * memory;
  const veilR = SHROUD_TINT[0] * shroud;
  const veilG = SHROUD_TINT[1] * shroud;
  const veilB = SHROUD_TINT[2] * shroud;
  const width = view.width;
  for (let y = rect.y0; y < rect.y1; y += 1) {
    const wy = view.y + y;
    const isRowInside = wy >= 0 && wy < H;
    const tileRow = wy - by;
    const tr = tileRow >= 0 && tileRow < rows * T ? tileRow >> TILE_SHIFT : -1;
    const bayerRow = (wy & 3) * 4;
    const hazeRow = ((wy + 1) & 3) * 4;
    const blockRow = (wy >> 1) * BW;
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const wx = view.x + x;
      const o = (y * width + x) * 4;
      out[o + 3] = 255;
      if (!isRowInside || wx < 0 || wx >= W) {
        out[o] = baseR;
        out[o + 1] = baseG;
        out[o + 2] = baseB;
        continue;
      }
      const i = (wy * W + wx) * 4;
      const block = blockRow + (wx >> 1);
      const k = block * 3;
      const tileCol = wx - bx;
      const sight =
        tr >= 0 && tileCol >= 0 && tileCol < cols * T
          ? (sights[tr * cols + (tileCol >> TILE_SHIFT)] as number)
          : -1;
      const threshold = BAYER[bayerRow + (wx & 3)] as number;
      const ar = albedo[i] as number;
      const ag = albedo[i + 1] as number;
      const ab = albedo[i + 2] as number;
      if (sight === SIGHT_HIDDEN) {
        const dim = hidden > 0 && threshold < 0.75 ? hidden : 0;
        out[o] = Math.max(baseR, ar * dim * 0.9);
        out[o + 1] = Math.max(baseG, ag * dim * 0.92);
        out[o + 2] = Math.max(baseB, ab * dim);
        continue;
      }
      const amb = ambient[block] as number;
      const mul = FACE_LIGHT[face[wy * W + wx] as number] as number;
      const lr = ((rgb[k] as number) + amb) * mul;
      const lg = ((rgb[k + 1] as number) + amb * 0.86) * mul;
      const lb = ((rgb[k + 2] as number) + amb * 0.72) * mul;
      const lum = Math.max(lr, lg, lb);
      const stepped = Math.floor(lum * levels + threshold) / levels;
      const q = Math.min(stepped, MAX_LEVEL);
      let r = baseR;
      let g = baseG;
      let b = baseB;
      if (q > 0) {
        const s = q / lum;
        r = Math.max(r, ar * lr * s);
        g = Math.max(g, ag * lg * s);
        b = Math.max(b, ab * lb * s);
      } else if (sight !== -1 && memory > 0 && threshold < 0.55) {
        r = Math.max(r, ar * memR);
        g = Math.max(g, ag * memG);
        b = Math.max(b, ab * memB);
      }
      const haze = beam[block] as number;
      if (
        haze > 0.05 &&
        q < 0.5 &&
        haze * HAZE_SHARE > (BAYER[hazeRow + ((wx + 2) & 3)] as number)
      ) {
        r = Math.max(r, hazeR * 0.16);
        g = Math.max(g, hazeG * 0.13);
        b = Math.max(b, hazeB * 0.09);
      }
      if (sight === SIGHT_SHROUD && ((wx >> 1) + (wy >> 1)) % 2 === 0) {
        r = Math.max(baseR, r * veilR);
        g = Math.max(baseG, g * veilG);
        b = Math.max(baseB, b * veilB);
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
    }
  }
}
