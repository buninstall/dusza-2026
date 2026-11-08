import type { Light } from "../../auth/lamp/lighting.ts";
import {
  addLight,
  createBuffer,
  type LightBuffer,
  lightBounds,
  type Region,
  resetBuffer,
  type SolidGrid,
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
  snap: (value: number) => number;
  lightAt: (x: number, y: number) => number;
  isVisible: (y: number, pad: number) => boolean;
  bake: (lights: readonly Light[]) => void;
  refresh: (region: Region) => void;
  render: (lights: readonly Light[], canRelight?: boolean) => void;
};

const AMBIENT = [0.44, 0.3, 1, 0.45, 0.36, 0.5, 0.5, 1.45];
const PAD_RATIO = 0.25;
const PENETRATION = 5;
const POOL = 4;
const MAX_DENSITY = 2;

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

function signature(lights: readonly Light[]): string {
  let out = "";
  for (const l of lights) {
    const cone = l.cone ? `${Math.round(l.cone.dx * 20)},${Math.round(l.cone.dy * 20)}` : "";
    out += `${Math.round(l.x)},${Math.round(l.y)},${Math.round(l.intensity * 24)},${cone};`;
  }
  return out;
}

function sizeLayer(layer: HTMLCanvasElement, W: number, H: number, scale: number, density = 1): void {
  layer.width = Math.round(W * density);
  layer.height = Math.round(H * density);
  layer.style.width = `${W * scale}px`;
  layer.style.height = `${H * scale}px`;
}

function fineContext(
  layer: HTMLCanvasElement,
  W: number,
  H: number,
  scale: number,
  density: number,
): CanvasRenderingContext2D | null {
  const context = layer.getContext("2d");
  if (!context) return null;
  sizeLayer(layer, W, H, scale, density);
  context.setTransform(density, 0, 0, density, 0, 0);
  context.imageSmoothingEnabled = false;
  return context;
}

export function createView(
  canvas: HTMLCanvasElement,
  spriteCanvas: HTMLCanvasElement,
  frontCanvas: HTMLCanvasElement | null,
  world: World,
  scale: number,
  viewHeight: number,
  ambient: readonly number[] = AMBIENT,
): View | null {
  const { W } = world;
  const pad = Math.ceil((viewHeight / scale) * PAD_RATIO);
  const H = Math.min(world.H, Math.ceil(viewHeight / scale) + pad * 2 + 2);
  const density = scale * Math.min(MAX_DENSITY, Math.max(1, window.devicePixelRatio || 1));
  const main = canvas.getContext("2d");
  const ctx = fineContext(spriteCanvas, W, H, scale, density);
  const base = document.createElement("canvas");
  base.width = W;
  base.height = world.H;
  const baseCtx = base.getContext("2d");
  if (!main || !ctx || !baseCtx) return null;
  sizeLayer(canvas, W, H, scale);
  main.imageSmoothingEnabled = false;
  const front = frontCanvas ? fineContext(frontCanvas, W, H, scale, density) : null;
  const layers = [canvas, spriteCanvas, frontCanvas].filter(
    (layer): layer is HTMLCanvasElement => layer !== null,
  );
  const frame = main.createImageData(W, H);
  const statics = createBuffer(Math.ceil(W / 2 + 1) * Math.ceil(world.H / 2 + 1));
  resetBuffer(statics, { x: 0, y: 0, w: W, h: world.H });
  const capacity = Math.ceil(W / 2 + 1) * Math.ceil(H / 2 + 1);
  const pool: LightBuffer[] = Array.from({ length: POOL }, () => createBuffer(capacity));
  let active: LightBuffer[] = [];
  let camY = 0;
  let shownCam = -1;
  let lastSignature = "";
  let isDirty = true;
  let lastRegions: Region[] = [];
  const grid: SolidGrid = { W, H: world.H, cells: new Uint8Array(W * world.H) };
  const syncGrid = (y0: number, y1: number) => {
    for (let i = Math.max(0, y0) * W; i < Math.min(world.H, y1) * W; i += 1) {
      const m = world.mask[i];
      grid.cells[i] = m === ROCK || m === PANEL || m === TIMBER ? 1 : 0;
    }
  };
  syncGrid(0, world.H);
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
    snap: (value) => Math.round(value * density) / density,
    lightAt: (x, y) => {
      const px = Math.floor(x);
      const py = Math.floor(y);
      let l = sample(statics, px, py);
      for (const buffer of active) l += sample(buffer, px, py);
      return l;
    },
    isVisible: (y, margin) => y >= camY - margin && y <= camY + H + margin,
    bake: (lights) => {
      syncGrid(0, world.H);
      statics.data.fill(0);
      for (const light of lights) addLight(statics, light, grid, PENETRATION);
      paintBase({ x: 0, y: 0, w: W, h: world.H });
      isDirty = true;
    },
    refresh: (region) => {
      const r = clip(region, W, 0, world.H);
      if (r) {
        syncGrid(r.y, r.y + r.h);
        paintBase(r);
      }
      isDirty = true;
    },
    render: (lights, canRelight = true) => {
      const scroll = window.scrollY;
      camY = Math.max(0, Math.min(world.H - H, Math.floor(scroll / scale) - pad));
      view.camY = camY;
      ctx.clearRect(0, 0, W, H);
      front?.clearRect(0, 0, W, H);
      const isMoved = camY !== shownCam;
      if (isMoved) {
        const transform = `translate3d(0, ${camY * scale}px, 0)`;
        for (const layer of layers) layer.style.transform = transform;
      }
      if (!isMoved && !isDirty && !canRelight) return;
      const sig = signature(lights);
      if (!isMoved && !isDirty && sig === lastSignature) return;
      const isFull = isMoved || isDirty;
      shownCam = camY;
      lastSignature = sig;
      isDirty = false;
      if (isFull) {
        main.drawImage(base, 0, camY, W, H, 0, 0, W, H);
      } else {
        for (const r of lastRegions)
          main.drawImage(base, r.x, r.y, r.w, r.h, r.x, r.y - camY, r.w, r.h);
      }
      const bounds = lights.map((light) => ({ light, box: lightBounds(light) }));
      const regions = merge(
        bounds.flatMap(({ box }) => {
          const r = clip(box, W, camY, camY + H);
          return r ? [r] : [];
        }),
      );
      active = [];
      lastRegions = regions.slice(0, POOL);
      lastRegions.forEach((region, index) => {
        const buffer = pool[index];
        if (!buffer || !resetBuffer(buffer, region)) return;
        for (const { light, box } of bounds) {
          if (overlaps(box, region)) addLight(buffer, light, grid, PENETRATION);
        }
        active.push(buffer);
        shadeRegion(world, ambient, statics, buffer, region, {
          data: frame.data,
          width: W,
          offsetX: 0,
          offsetY: camY,
        });
        main.putImageData(frame, 0, 0, region.x, region.y - camY, region.w, region.h);
      });
    },
  };
  return view;
}
