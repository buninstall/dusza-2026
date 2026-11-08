import type { View } from "./camera.ts";
import type { SceneLayout } from "./layout.ts";
import type { LightField } from "./light.ts";
import { hash } from "./scene-art.ts";

export type Mote = {
  x: number;
  y: number;
  speed: number;
  phase: number;
  x0: number;
  y0: number;
  w: number;
  h: number;
};

const COUNT = 80;
const SPREAD = 60;
const MIN_LIGHT = 0.18;

export function createMotes(layout: SceneLayout): Mote[] {
  const x0 = layout.postL - SPREAD;
  const y0 = layout.beamY - SPREAD;
  const w = layout.bw + 2 * (SPREAD + 12);
  const h = layout.bh + 2 * SPREAD;
  return Array.from({ length: COUNT }, (_, index) => ({
    x: hash(index, 1, 77),
    y: hash(index, 2, 77),
    speed: 0.4 + hash(index, 3, 77) * 0.8,
    phase: index * 1.7,
    x0,
    y0,
    w,
    h,
  }));
}

export function stepMotes(motes: Mote[], dt: number): void {
  for (const mote of motes) {
    mote.phase += dt;
    mote.x =
      (((mote.x + (Math.sin(mote.phase * 0.4) * 0.6 + 0.25) * mote.speed * dt * 0.004) % 1) + 1) %
      1;
    mote.y =
      (((mote.y + Math.cos(mote.phase * 0.3) * mote.speed * dt * 0.003 + dt * 0.0008) % 1) + 1) % 1;
  }
}

export function motePixel(mote: Mote): { x: number; y: number } {
  return { x: Math.round(mote.x0 + mote.x * mote.w), y: Math.round(mote.y0 + mote.y * mote.h) };
}

export function drawMotes(
  ctx: CanvasRenderingContext2D,
  view: View,
  motes: readonly Mote[],
  field: LightField,
  color: string,
  time: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (const mote of motes) {
    const { x: wx, y: wy } = motePixel(mote);
    const x = wx - view.x;
    const y = wy - view.y;
    if (x < 0 || y < 0 || x >= view.width || y >= view.height) {
      continue;
    }
    const lum = field.at(wx, wy);
    if (lum < MIN_LIGHT) {
      continue;
    }
    const twinkle = 0.5 + 0.5 * Math.sin(time * 3 + mote.phase);
    ctx.globalAlpha = Math.min(0.75, lum * 0.55) * twinkle;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}
