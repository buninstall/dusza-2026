import { bayer } from "../../auth/lamp/lighting.ts";
import type { PixelRows } from "../../pixel/pixel-art.ts";
import { DEFAULT_STRATA } from "./palette.ts";

export const OPEN = 0;
export const ROCK = 1;
export const SKY = 2;
export const PANEL = 3;
export const WATER = 4;
export const TIMBER = 5;
export const NICHE = 6;
export const LAVA = 7;

export type Rgb = readonly [number, number, number];
export type Tone = string | Rgb;
export type Point = { x: number; y: number };

export type Vein = {
  cx: number;
  cy: number;
  cells: [number, number][];
  isMined: boolean;
  phase: number;
};
export type Drip = { x: number; top: number; floor: number };
export type Glow = {
  x: number;
  y: number;
  phase: number;
  kind: "worm" | "mushroom" | "moss" | "lava";
};
export type CrystalKind = "gem" | "amethyst" | "emerald";
export type Crystal = { x: number; y: number; phase: number; kind: CrystalKind };
export type Twinkle = { x: number; y: number; phase: number; bright: number };

export type World = {
  W: number;
  H: number;
  data: Uint8ClampedArray;
  mask: Uint8Array;
  groundY: number;
  strata: number[];
  palette: Readonly<Record<string, string>>;
  veins: Vein[];
  crystals: Crystal[];
  lavas: Point[];
  roosts: Point[];
  drips: Drip[];
  puddles: Point[];
  stars: Twinkle[];
  glows: Glow[];
  put: (x: number, y: number, tone: Tone) => void;
  rect: (x: number, y: number, w: number, h: number, tone: Tone) => void;
  setMask: (x: number, y: number, w: number, h: number, value: number) => void;
  maskAt: (x: number, y: number) => number;
  rows: (art: PixelRows, tones: Readonly<Record<string, Tone>>, x: number, y: number) => void;
  line: (x0: number, y0: number, x1: number, y1: number, tone: Tone | null) => Point[];
  pixel: (x: number, y: number) => Rgb;
  rgb: (tone: Tone) => Rgb;
  shift: Float32Array;
};

export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function noise(x: number, y: number, cell: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = smooth(x / cell - gx);
  const fy = smooth(y / cell - gy);
  const a = hash(gx, gy);
  const b = hash(gx + 1, gy);
  const c = hash(gx, gy + 1);
  const d = hash(gx + 1, gy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

export function dither(x: number, y: number): number {
  return bayer(x, y);
}

export function parseHex(hex: string): Rgb {
  const value = hex.startsWith("#") && hex.length >= 7 ? hex : "#000000";
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

export function scaled(tone: Rgb, k: number): Rgb {
  return [
    Math.min(255, tone[0] * k) | 0,
    Math.min(255, tone[1] * k) | 0,
    Math.min(255, tone[2] * k) | 0,
  ];
}

export function toneHex(palette: Readonly<Record<string, string>>, tone: string): string {
  return tone.startsWith("#") ? tone : (palette[tone] ?? "#000000");
}

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(
  W: number,
  H: number,
  palette: Readonly<Record<string, string>>,
): World {
  const data = new Uint8ClampedArray(W * H * 4);
  const mask = new Uint8Array(W * H).fill(ROCK);
  const cache = new Map<string, Rgb>();
  const resolve = (tone: Tone): Rgb => {
    if (typeof tone !== "string") return tone;
    const hit = cache.get(tone);
    if (hit) return hit;
    const rgb = parseHex(toneHex(palette, tone));
    cache.set(tone, rgb);
    return rgb;
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const put = (x: number, y: number, tone: Tone) => {
    if (!inside(x, y)) return;
    const [r, g, b] = resolve(tone);
    const i = (y * W + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  const rect = (x: number, y: number, w: number, h: number, tone: Tone) => {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) put(xx, yy, tone);
  };
  const setMask = (x: number, y: number, w: number, h: number, value: number) => {
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy += 1) {
      mask.fill(value, yy * W + Math.max(0, x), yy * W + Math.min(W, x + w));
    }
  };
  const maskAt = (x: number, y: number) => (inside(x, y) ? (mask[y * W + x] ?? ROCK) : ROCK);
  const rows = (art: PixelRows, tones: Readonly<Record<string, Tone>>, x: number, y: number) => {
    art.forEach((row, r) => {
      for (let c = 0; c < row.length; c += 1) {
        const tone = tones[row[c] ?? "."];
        if (tone) put(x + c, y + r, tone);
      }
    });
  };
  const line = (x0: number, y0: number, x1: number, y1: number, tone: Tone | null) => {
    const points: Point[] = [];
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (let guard = 0; guard < 100000; guard += 1) {
      if (tone) put(x, y, tone);
      points.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return points;
  };
  const pixel = (x: number, y: number): Rgb => {
    const i = (y * W + x) * 4;
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
  };
  return {
    W,
    H,
    data,
    mask,
    groundY: 0,
    strata: [...DEFAULT_STRATA],
    palette,
    veins: [],
    crystals: [],
    lavas: [],
    roosts: [],
    drips: [],
    puddles: [],
    stars: [],
    glows: [],
    put,
    rect,
    setMask,
    maskAt,
    rows,
    line,
    pixel,
    rgb: resolve,
    shift: new Float32Array(W),
  };
}

export type Box = { x: number; y: number; w: number; h: number };

function layoutRect(element: Element): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  if (!(element instanceof HTMLElement)) {
    const r = element.getBoundingClientRect();
    return {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      width: r.width,
      height: r.height,
    };
  }
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = element;
  while (node) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

export function measureBox(element: Element, scale: number): Box {
  const r = layoutRect(element);
  const x = Math.floor(r.left / scale);
  const y = Math.floor(r.top / scale);
  return {
    x,
    y,
    w: Math.ceil((r.left + r.width) / scale) - x,
    h: Math.ceil((r.top + r.height) / scale) - y,
  };
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function flicker(time: number, seed: number): number {
  return 0.82 + 0.1 * Math.sin(time * 11 + seed) + 0.08 * Math.sin(time * 27 + seed * 3);
}

export function pageHeight(): number {
  const shell = document.querySelector(".shell");
  const content = shell
    ? shell.getBoundingClientRect().height
    : document.body.getBoundingClientRect().height;
  return Math.ceil(Math.max(content, window.innerHeight));
}
