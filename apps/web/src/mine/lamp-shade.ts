import type { Dir, Pos } from "@minescript/engine";
import { TILE_SIZE } from "../pixel/tiles.ts";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export const REVEAL_MS = 520;
export const QUICK_REVEAL_MS = 180;
export const FADE_MS = 720;
const WAVE_MS_PER_TILE = 90;
const WAVE_MAX_MS = 900;
const QUICK_MS_PER_TILE = 20;
const QUICK_MAX_MS = 80;
const EMBER_BAND = 0.16;
const MEMORY_SEEN = 0.42;
const MEMORY_LIT = 0.6;
const LIGHT_CORE = 0.55;
const GLOW_ALPHA = 46;
const EMBER_ALPHA = 210;
const HEADLAMP_SHIFT = 0.18;
const LIGHT_PAD = 0.7;
const HAZE_REACH = 1.6;
const HAZE_DENSITY = 0.55;
const HAZE_MIX = 0.22;

export type Rgb = readonly [number, number, number];

export type TileFade = {
  from: number;
  to: number;
  start: number;
  delay: number;
  duration: number;
};

export type RevealPace = "instant" | "wave" | "quick";

export type RevealState = ReadonlyMap<string, TileFade>;

export type LightSpot = { x: number; y: number; radius: number };

export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)] ?? 0.5;
}

function smooth(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function keyPos(key: string): Pos {
  const [row = 0, col = 0] = key.split(":").map(Number);
  return { row, col };
}

function distanceFrom(key: string, origin: Pos): number {
  const pos = keyPos(key);
  return Math.abs(pos.row - origin.row) + Math.abs(pos.col - origin.col);
}

function waveDelay(key: string, origin: Pos): number {
  return Math.min(distanceFrom(key, origin) * WAVE_MS_PER_TILE, WAVE_MAX_MS);
}

function revealTiming(pace: RevealPace, key: string, origin: Pos) {
  if (pace === "instant") {
    return { delay: 0, duration: 1 };
  }
  if (pace === "quick") {
    const delay = Math.min(distanceFrom(key, origin) * QUICK_MS_PER_TILE, QUICK_MAX_MS);
    return { delay, duration: QUICK_REVEAL_MS };
  }
  return { delay: waveDelay(key, origin), duration: REVEAL_MS };
}

export function fadeLevel(fade: TileFade | undefined, now: number): number {
  if (!fade) {
    return 0;
  }
  const t = smooth((now - fade.start - fade.delay) / fade.duration);
  return fade.from + (fade.to - fade.from) * t;
}

export function isSettled(state: RevealState, now: number): boolean {
  for (const fade of state.values()) {
    if (fadeLevel(fade, now) !== fade.to) {
      return false;
    }
  }
  return true;
}

export function scheduleReveal(
  state: RevealState,
  visible: ReadonlySet<string>,
  origin: Pos,
  now: number,
  pace: RevealPace,
): Map<string, TileFade> {
  const isInstant = pace === "instant";
  const next = new Map<string, TileFade>();
  for (const key of visible) {
    const current = state.get(key);
    if (current && current.to === 1) {
      next.set(key, current);
      continue;
    }
    const from = isInstant ? 1 : fadeLevel(current, now);
    next.set(key, { from, to: 1, start: now, ...revealTiming(pace, key, origin) });
  }
  for (const [key, fade] of state) {
    if (visible.has(key)) {
      continue;
    }
    const level = fadeLevel(fade, now);
    if (isInstant || (fade.to === 0 && level === 0)) {
      continue;
    }
    next.set(
      key,
      fade.to === 0
        ? fade
        : {
            from: level,
            to: 0,
            start: now,
            delay: waveDelay(key, origin) / 2,
            duration: FADE_MS,
          },
    );
  }
  return next;
}

const AHEAD: Record<Dir, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

export function lightSpot(pos: Pos, dir: Dir, radius: number): LightSpot {
  const ahead = AHEAD[dir];
  return {
    x: (pos.col + 0.5 + ahead.dx * HEADLAMP_SHIFT) * TILE_SIZE,
    y: (pos.row + 0.5 + ahead.dy * HEADLAMP_SHIFT) * TILE_SIZE,
    radius: radius <= 0 ? LIGHT_PAD * TILE_SIZE : (radius + LIGHT_PAD) * TILE_SIZE,
  };
}

export function mixSpot(from: LightSpot, to: LightSpot, t: number): LightSpot {
  const k = smooth(t);
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    radius: from.radius + (to.radius - from.radius) * k,
  };
}

export type ShadeFrame = {
  cols: number;
  rows: number;
  level: (row: number, col: number) => number;
  isSeen: (row: number, col: number) => boolean;
  spot: LightSpot;
  intensity: number;
  void: Rgb;
  ember: Rgb;
  glow: Rgb;
  haze: Rgb;
};

export function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

export const HAZE_AMOUNT = HAZE_MIX;

const scratch = new Uint8ClampedArray(4);
const scratchWord = new Uint32Array(scratch.buffer);

function pack(color: Rgb, alpha: number): number {
  scratch[0] = color[0];
  scratch[1] = color[1];
  scratch[2] = color[2];
  scratch[3] = alpha;
  return scratchWord[0] ?? 0;
}

type Inks = {
  void: number;
  haze: number;
  ember: number;
  glow: (alpha: number) => number;
};

function inksOf(frame: ShadeFrame): Inks {
  const glowWords = new Map<number, number>();
  return {
    void: pack(frame.void, 255),
    haze: pack(frame.haze, 255),
    ember: pack(frame.ember, EMBER_ALPHA),
    glow: (alpha) => {
      const hit = glowWords.get(alpha);
      if (hit !== undefined) {
        return hit;
      }
      const word = pack(frame.glow, alpha);
      glowWords.set(alpha, word);
      return word;
    },
  };
}

function hazeAt(frame: ShadeFrame, x: number, y: number): number {
  const { spot } = frame;
  const reach = spot.radius * HAZE_REACH;
  if (reach <= 0 || frame.intensity <= 0) {
    return 0;
  }
  const distance = Math.hypot(x + 0.5 - spot.x, y + 0.5 - spot.y);
  return distance >= reach ? 0 : smooth((reach - distance) / reach) * frame.intensity;
}

function hidden(frame: ShadeFrame, inks: Inks, x: number, y: number): number {
  const haze = hazeAt(frame, x, y);
  return haze * HAZE_DENSITY > bayer(x + 1, y + 3) ? inks.haze : inks.void;
}

function lightAt(frame: ShadeFrame, x: number, y: number): number {
  const { spot } = frame;
  if (spot.radius <= 0 || frame.intensity <= 0) {
    return 0;
  }
  const distance = Math.hypot(x + 0.5 - spot.x, y + 0.5 - spot.y);
  if (distance >= spot.radius) {
    return 0;
  }
  const edge = spot.radius * (1 - LIGHT_CORE);
  return smooth((spot.radius - distance) / edge) * frame.intensity;
}

function nearest(lo: number, hi: number): number {
  if (lo > 0) {
    return lo;
  }
  return hi < 0 ? -hi : 0;
}

function isBeyond(frame: ShadeFrame, row: number, col: number, reach: number): boolean {
  const { spot } = frame;
  const x0 = col * TILE_SIZE;
  const y0 = row * TILE_SIZE;
  const last = TILE_SIZE - 1;
  const gapX = nearest(x0 + 0.5 - spot.x, x0 + last + 0.5 - spot.x);
  const gapY = nearest(y0 + 0.5 - spot.y, y0 + last + 0.5 - spot.y);
  return gapX >= reach || gapY >= reach;
}

function isHazeFree(frame: ShadeFrame, row: number, col: number): boolean {
  const reach = frame.spot.radius * HAZE_REACH;
  return reach <= 0 || frame.intensity <= 0 || isBeyond(frame, row, col, reach);
}

function isLightFree(frame: ShadeFrame, row: number, col: number): boolean {
  const { radius } = frame.spot;
  return radius <= 0 || frame.intensity <= 0 || isBeyond(frame, row, col, radius);
}

type Target = { words: Uint32Array; inks: Inks; width: number };

function fillTile(frame: ShadeFrame, target: Target, row: number, col: number, hasHaze: boolean) {
  const { words, inks, width } = target;
  for (let py = 0; py < TILE_SIZE; py += 1) {
    const y = row * TILE_SIZE + py;
    const start = y * width + col * TILE_SIZE;
    if (!hasHaze) {
      words.fill(inks.void, start, start + TILE_SIZE);
      continue;
    }
    for (let px = 0; px < TILE_SIZE; px += 1) {
      words[start + px] = hidden(frame, inks, col * TILE_SIZE + px, y);
    }
  }
}

function shadeTile(frame: ShadeFrame, target: Target, row: number, col: number): void {
  const { words, inks, width } = target;
  const reveal = frame.level(row, col);
  const hasHaze = !isHazeFree(frame, row, col);
  if (reveal <= 0) {
    fillTile(frame, target, row, col, hasHaze);
    return;
  }
  const hasLight = !isLightFree(frame, row, col);
  const memory = frame.isSeen(row, col) ? MEMORY_SEEN : MEMORY_LIT;
  for (let py = 0; py < TILE_SIZE; py += 1) {
    const y = row * TILE_SIZE + py;
    for (let px = 0; px < TILE_SIZE; px += 1) {
      const x = col * TILE_SIZE + px;
      const index = y * width + x;
      const threshold = bayer(x + 2, y + 1);
      if (reveal <= threshold) {
        words[index] = hasHaze ? hidden(frame, inks, x, y) : inks.void;
        continue;
      }
      if (reveal < 1 && reveal - threshold < EMBER_BAND) {
        words[index] = inks.ember;
        continue;
      }
      const light = hasLight ? lightAt(frame, x, y) : 0;
      if (memory * (1 - light) * (1 - light) > bayer(x, y)) {
        words[index] = inks.void;
        continue;
      }
      words[index] = inks.glow(Math.round(light * GLOW_ALPHA));
    }
  }
}

export function shadeInto(frame: ShadeFrame, out: Uint8ClampedArray): void {
  const isAligned = out.byteOffset % 4 === 0 && out.byteLength % 4 === 0;
  const bytes = isAligned ? out : new Uint8ClampedArray(out);
  const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
  const target = { words, inks: inksOf(frame), width: frame.cols * TILE_SIZE };
  for (let row = 0; row < frame.rows; row += 1) {
    for (let col = 0; col < frame.cols; col += 1) {
      shadeTile(frame, target, row, col);
    }
  }
  if (!isAligned) {
    out.set(bytes);
  }
}

export function parseRgb(value: string): Rgb | null {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) {
    return null;
  }
  const number = Number.parseInt(hex, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

export function flicker(now: number): number {
  return 0.94 + 0.04 * Math.sin(now / 97) + 0.02 * Math.sin(now / 23 + 1.7);
}
