import type { Light } from "../../auth/lamp/lighting.ts";
import {
  addLight,
  createBuffer,
  type LightBuffer,
  lightBounds,
  type Region,
  resetBuffer,
  sample,
  shadeRegion,
} from "./lightmap.ts";
import { PANEL, ROCK, TIMBER, type World } from "./world.ts";

export type View = {
  ctx: CanvasRenderingContext2D;
  front: CanvasRenderingContext2D | null;
  W: number;
  H: number;
  camY: number;
  lightAt: (x: number, y: number) => number;
  isVisible: (y: number, pad: number) => boolean;
  bake: (lights: readonly Light[]) => void;
  refresh: (region: Region) => void;
  render: (lights: readonly Light[]) => void;
};

const AMBIENT = [0.44, 0.3, 1, 0.45, 0.36, 0.5, 0.5];
const PAD_RATIO = 0.25;
const PENETRATION = 5;
const POOL = 4;

function overlaps(a: Region, b: Region): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function union(a: Region, b: Region): Region {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function clip(r: Region, W: number, top: number, bottom: number): Region | null {
  const x = Math.max(0, r.x);
  const y = Math.max(top, r.y);
  const w = Math.min(W, r.x + r.w) - x;
  const h = Math.min(bottom, r.y + r.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

function merge(regions: readonly Region[]): Region[] {
  const list = [...regions];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a && b && overlaps(a, b)) {
        list[i] = union(a, b);
        list.splice(j, 1);
        j = i;
      }
    }
  }
  return list;
}

export function createView(
  canvas: HTMLCanvasElement,
  frontCanvas: HTMLCanvasElement | null,
  world: World,
  scale: number,
  viewHeight: number,
  ambient: readonly number[] = AMBIENT,
): View | null {
  const { W } = world;
  const pad = Math.ceil((viewHeight / scale) * PAD_RATIO);
  const H = Math.min(world.H, Math.ceil(viewHeight / scale) + pad * 2 + 2);
  const ctx = canvas.getContext("2d");
  const base = document.createElement("canvas");
  base.width = W;
  base.height = world.H;
  const baseCtx = base.getContext("2d");
  if (!ctx || !baseCtx) return null;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  ctx.imageSmoothingEnabled = false;
  const front = frontCanvas?.getContext("2d") ?? null;
  if (frontCanvas && front) {
    frontCanvas.width = W;
    frontCanvas.height = H;
    frontCanvas.style.width = `${W * scale}px`;
    frontCanvas.style.height = `${H * scale}px`;
    front.imageSmoothingEnabled = false;
  }
  const frame = ctx.createImageData(W, H);
  const statics = createBuffer(Math.ceil(W / 2 + 1) * Math.ceil(world.H / 2 + 1));
  resetBuffer(statics, { x: 0, y: 0, w: W, h: world.H });
  const capacity = Math.ceil(W / 2 + 1) * Math.ceil(H / 2 + 1);
  const pool: LightBuffer[] = Array.from({ length: POOL }, () => createBuffer(capacity));
  let active: LightBuffer[] = [];
  let camY = 0;
  const isSolid = (x: number, y: number) => {
    const m = world.maskAt(x, y);
    return m === ROCK || m === PANEL || m === TIMBER;
  };
  const paintBase = (region: Region) => {
    const image = baseCtx.createImageData(region.w, region.h);
    shadeRegion(world, ambient, statics, null, region, {
      data: image.data,
      width: region.w,
      offsetX: region.x,
      offsetY: region.y,
    });
    baseCtx.putImageData(image, region.x, region.y);
  };
  const view: View = {
    ctx,
    front,
    W,
    H,
    camY,
    lightAt: (x, y) => {
      const px = Math.floor(x);
      const py = Math.floor(y);
      let l = sample(statics, px, py);
      for (const buffer of active) l += sample(buffer, px, py);
      return l;
    },
    isVisible: (y, margin) => y >= camY - margin && y <= camY + H + margin,
    bake: (lights) => {
      statics.data.fill(0);
      for (const light of lights) addLight(statics, light, isSolid, PENETRATION);
      paintBase({ x: 0, y: 0, w: W, h: world.H });
    },
    refresh: (region) => {
      const r = clip(region, W, 0, world.H);
      if (r) paintBase(r);
    },
    render: (lights) => {
      const scroll = window.scrollY;
      camY = Math.max(0, Math.min(world.H - H, Math.floor(scroll / scale) - pad));
      view.camY = camY;
      canvas.style.transform = `translate3d(0, ${camY * scale}px, 0)`;
      if (frontCanvas && front) {
        frontCanvas.style.transform = canvas.style.transform;
        front.clearRect(0, 0, W, H);
      }
      ctx.drawImage(base, 0, camY, W, H, 0, 0, W, H);
      const bounds = lights.map((light) => ({ light, box: lightBounds(light) }));
      const regions = merge(
        bounds.flatMap(({ box }) => {
          const r = clip(box, W, camY, camY + H);
          return r ? [r] : [];
        }),
      );
      active = [];
      regions.slice(0, POOL).forEach((region, index) => {
        const buffer = pool[index];
        if (!buffer || !resetBuffer(buffer, region)) return;
        for (const { light, box } of bounds) {
          if (overlaps(box, region)) addLight(buffer, light, isSolid, PENETRATION);
        }
        active.push(buffer);
        shadeRegion(world, ambient, statics, buffer, region, {
          data: frame.data,
          width: W,
          offsetX: 0,
          offsetY: camY,
        });
        ctx.putImageData(frame, 0, 0, region.x, region.y - camY, region.w, region.h);
      });
    },
  };
  return view;
}
