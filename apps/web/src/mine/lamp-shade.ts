import type { Dir, Pos } from "@minescript/engine";
import { TILE_SIZE } from "../pixel/tiles.ts";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export const REVEAL_MS = 520;
export const FADE_MS = 720;
const WAVE_MS_PER_TILE = 90;
const WAVE_MAX_MS = 900;
const EMBER_BAND = 0.16;
const MEMORY_SEEN = 0.42;
const MEMORY_LIT = 0.6;
const LIGHT_CORE = 0.55;
const GLOW_ALPHA = 46;
const EMBER_ALPHA = 210;
const HEADLAMP_SHIFT = 0.18;
const LIGHT_PAD = 0.7;

export type Rgb = readonly [number, number, number];

export type TileFade = { from: number; to: number; start: number; delay: number };

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

function waveDelay(key: string, origin: Pos): number {
  const pos = keyPos(key);
  const distance = Math.abs(pos.row - origin.row) + Math.abs(pos.col - origin.col);
  return Math.min(distance * WAVE_MS_PER_TILE, WAVE_MAX_MS);
}

export function fadeLevel(fade: TileFade | undefined, now: number): number {
  if (!fade) {
    return 0;
  }
  const duration = fade.to > fade.from ? REVEAL_MS : FADE_MS;
  const t = smooth((now - fade.start - fade.delay) / duration);
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
  isInstant: boolean,
): Map<string, TileFade> {
  const next = new Map<string, TileFade>();
  for (const key of visible) {
    const current = state.get(key);
    if (current && current.to === 1) {
      next.set(key, current);
      continue;
    }
    const from = isInstant ? 1 : fadeLevel(current, now);
    next.set(key, { from, to: 1, start: now, delay: isInstant ? 0 : waveDelay(key, origin) });
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
      fade.to === 0 ? fade : { from: level, to: 0, start: now, delay: waveDelay(key, origin) / 2 },
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
};

function put(out: Uint8ClampedArray, index: number, color: Rgb, alpha: number): void {
  out[index] = color[0];
  out[index + 1] = color[1];
  out[index + 2] = color[2];
  out[index + 3] = alpha;
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

function fillTile(frame: ShadeFrame, out: Uint8ClampedArray, row: number, col: number): void {
  const width = frame.cols * TILE_SIZE;
  for (let py = 0; py < TILE_SIZE; py += 1) {
    const start = ((row * TILE_SIZE + py) * width + col * TILE_SIZE) * 4;
    for (let px = 0; px < TILE_SIZE; px += 1) {
      put(out, start + px * 4, frame.void, 255);
    }
  }
}

function shadeTile(frame: ShadeFrame, out: Uint8ClampedArray, row: number, col: number): void {
  const width = frame.cols * TILE_SIZE;
  const reveal = frame.level(row, col);
  if (reveal <= 0) {
    fillTile(frame, out, row, col);
    return;
  }
  const memory = frame.isSeen(row, col) ? MEMORY_SEEN : MEMORY_LIT;
  for (let py = 0; py < TILE_SIZE; py += 1) {
    const y = row * TILE_SIZE + py;
    for (let px = 0; px < TILE_SIZE; px += 1) {
      const x = col * TILE_SIZE + px;
      const index = (y * width + x) * 4;
      const threshold = bayer(x + 2, y + 1);
      if (reveal <= threshold) {
        put(out, index, frame.void, 255);
        continue;
      }
      if (reveal < 1 && reveal - threshold < EMBER_BAND) {
        put(out, index, frame.ember, EMBER_ALPHA);
        continue;
      }
      const light = lightAt(frame, x, y);
      if (memory * (1 - light) * (1 - light) > bayer(x, y)) {
        put(out, index, frame.void, 255);
        continue;
      }
      put(out, index, frame.glow, Math.round(light * GLOW_ALPHA));
    }
  }
}

export function shadeInto(frame: ShadeFrame, out: Uint8ClampedArray): void {
  for (let row = 0; row < frame.rows; row += 1) {
    for (let col = 0; col < frame.cols; col += 1) {
      shadeTile(frame, out, row, col);
    }
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
