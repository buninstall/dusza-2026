import { bayer, type Light } from "../../auth/lamp/lighting.ts";
import type { World } from "./world.ts";

const RAY_STEP = 1.5;
const NEAR_LAMP = 7;
const MIN_CONTRIBUTION = 0.015;
const LEVELS = 5;
const MAX_LEVEL = 1.35;
const BASE = [6, 5, 4] as const;

export type LightBuffer = { bx: number; by: number; bw: number; bh: number; data: Float32Array };
export type Region = { x: number; y: number; w: number; h: number };

export function createBuffer(capacity: number): LightBuffer {
  return { bx: 0, by: 0, bw: 0, bh: 0, data: new Float32Array(capacity * 3) };
}

export function resetBuffer(buffer: LightBuffer, region: Region): boolean {
  const bx = region.x >> 1;
  const by = region.y >> 1;
  const bw = ((region.x + region.w + 1) >> 1) - bx;
  const bh = ((region.y + region.h + 1) >> 1) - by;
  if (bw * bh * 3 > buffer.data.length) return false;
  buffer.bx = bx;
  buffer.by = by;
  buffer.bw = bw;
  buffer.bh = bh;
  buffer.data.fill(0, 0, bw * bh * 3);
  return true;
}

function strength(source: Light, dx: number, dy: number, distance: number): number {
  let f = (1 - distance / source.radius) ** source.falloff;
  const cone = source.cone;
  if (cone) {
    if (distance <= NEAR_LAMP) return f * 0.6 * source.intensity;
    const cos = (dx * cone.dx + dy * cone.dy) / distance;
    const inner = Math.cos(cone.half);
    const outer = Math.cos(cone.half + cone.soft);
    if (cos < outer) return 0;
    if (cos < inner) {
      const t = (cos - outer) / (inner - outer);
      f *= t * t * (3 - 2 * t);
    }
  }
  return f * source.intensity;
}

function isBlocked(
  lx: number,
  ly: number,
  x: number,
  y: number,
  isSolid: (x: number, y: number) => boolean,
  penetration: number,
): boolean {
  const dx = x - lx;
  const dy = y - ly;
  const steps = Math.ceil(Math.hypot(dx, dy) / RAY_STEP);
  if (steps < 2) return false;
  const sx = dx / steps;
  const sy = dy / steps;
  let inside = 0;
  for (let i = 1; i < steps; i += 1) {
    if (isSolid(Math.floor(lx + sx * i), Math.floor(ly + sy * i))) {
      inside += RAY_STEP;
      if (inside > penetration) return true;
    }
  }
  return false;
}

export function lightBounds(light: Light): Region {
  const r = light.radius;
  const cone = light.cone;
  if (!cone)
    return {
      x: Math.floor(light.x - r),
      y: Math.floor(light.y - r),
      w: Math.ceil(r * 2) + 1,
      h: Math.ceil(r * 2) + 1,
    };
  const base = Math.atan2(cone.dy, cone.dx);
  const spread = cone.half + cone.soft;
  const xs = [light.x - NEAR_LAMP, light.x + NEAR_LAMP];
  const ys = [light.y - NEAR_LAMP, light.y + NEAR_LAMP];
  for (let k = 0; k <= 6; k += 1) {
    const a = base - spread + (spread * 2 * k) / 6;
    xs.push(light.x + Math.cos(a) * r);
    ys.push(light.y + Math.sin(a) * r);
  }
  const x0 = Math.floor(Math.min(...xs));
  const y0 = Math.floor(Math.min(...ys));
  return {
    x: x0,
    y: y0,
    w: Math.ceil(Math.max(...xs)) - x0 + 1,
    h: Math.ceil(Math.max(...ys)) - y0 + 1,
  };
}

export function addLight(
  buffer: LightBuffer,
  source: Light,
  isSolid: (x: number, y: number) => boolean,
  penetration: number,
): void {
  const r = source.radius;
  const x0 = Math.max(buffer.bx, Math.floor((source.x - r) / 2));
  const x1 = Math.min(buffer.bx + buffer.bw - 1, Math.floor((source.x + r) / 2));
  const y0 = Math.max(buffer.by, Math.floor((source.y - r) / 2));
  const y1 = Math.min(buffer.by + buffer.bh - 1, Math.floor((source.y + r) / 2));
  const [cr, cg, cb] = source.color;
  const data = buffer.data;
  for (let by = y0; by <= y1; by += 1) {
    const y = by * 2 + 1;
    const dy = y - source.y;
    for (let bx = x0; bx <= x1; bx += 1) {
      const x = bx * 2 + 1;
      const dx = x - source.x;
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      const f = strength(source, dx, dy, Math.sqrt(d2) + 0.0001);
      if (f < MIN_CONTRIBUTION) continue;
      if (source.hasShadow !== false && isBlocked(source.x, source.y, x, y, isSolid, penetration))
        continue;
      const k = ((by - buffer.by) * buffer.bw + (bx - buffer.bx)) * 3;
      data[k] = (data[k] ?? 0) + f * cr;
      data[k + 1] = (data[k + 1] ?? 0) + f * cg;
      data[k + 2] = (data[k + 2] ?? 0) + f * cb;
    }
  }
}

export function sample(buffer: LightBuffer, x: number, y: number): number {
  const bx = (x >> 1) - buffer.bx;
  const by = (y >> 1) - buffer.by;
  if (bx < 0 || by < 0 || bx >= buffer.bw || by >= buffer.bh) return 0;
  const k = (by * buffer.bw + bx) * 3;
  return Math.max(buffer.data[k] ?? 0, buffer.data[k + 1] ?? 0, buffer.data[k + 2] ?? 0);
}

export type ShadeTarget = {
  data: Uint8ClampedArray;
  width: number;
  offsetX: number;
  offsetY: number;
};

export function shadeRegion(
  world: World,
  ambient: readonly number[],
  statics: LightBuffer,
  extra: LightBuffer | null,
  region: Region,
  target: ShadeTarget,
): void {
  const { W, data: albedo, mask } = world;
  const out = target.data;
  const sd = statics.data;
  const ed = extra?.data;
  const x0 = Math.max(0, region.x);
  const x1 = Math.min(W, region.x + region.w);
  const y0 = Math.max(0, region.y);
  const y1 = Math.min(world.H, region.y + region.h);
  for (let y = y0; y < y1; y += 1) {
    const sRow = ((y >> 1) - statics.by) * statics.bw - statics.bx;
    const eBy = extra ? (y >> 1) - extra.by : -1;
    const eRow = extra && eBy >= 0 && eBy < extra.bh ? eBy * extra.bw - extra.bx : -1;
    const outRow = (y - target.offsetY) * target.width;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * W + x) * 4;
      const o = (outRow + x - target.offsetX) * 4;
      const sk = (sRow + (x >> 1)) * 3;
      const amb = ambient[mask[y * W + x] ?? 1] ?? 0;
      let lr = (sd[sk] ?? 0) + amb;
      let lg = (sd[sk + 1] ?? 0) + amb * 0.82;
      let lb = (sd[sk + 2] ?? 0) + amb * 0.66;
      if (ed && eRow >= 0 && extra) {
        const ex = (x >> 1) - extra.bx;
        if (ex >= 0 && ex < extra.bw) {
          const ek = (eRow + (x >> 1)) * 3;
          lr += ed[ek] ?? 0;
          lg += ed[ek + 1] ?? 0;
          lb += ed[ek + 2] ?? 0;
        }
      }
      const lum = Math.max(lr, lg, lb);
      const q = Math.min(MAX_LEVEL, Math.floor(lum * LEVELS + bayer(x, y)) / LEVELS);
      if (q > 0) {
        const s = q / lum;
        out[o] = Math.max(BASE[0], (albedo[i] ?? 0) * lr * s);
        out[o + 1] = Math.max(BASE[1], (albedo[i + 1] ?? 0) * lg * s);
        out[o + 2] = Math.max(BASE[2], (albedo[i + 2] ?? 0) * lb * s);
      } else {
        out[o] = BASE[0];
        out[o + 1] = BASE[1];
        out[o + 2] = BASE[2];
      }
      out[o + 3] = 255;
    }
  }
}
