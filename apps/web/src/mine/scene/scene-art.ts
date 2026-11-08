import type { PixelRows } from "../../pixel/pixel-art.ts";
import type { Rgb } from "./light.ts";

const FALLBACK = "#000000";
const TRANSPARENT = ".";

export type Colors = {
  css: (tone: string) => string;
  rgb: (tone: string) => Rgb;
};

export type Tones = Readonly<Record<string, string>>;

function hexToRgb(value: string): Rgb {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) {
    return [0, 0, 0];
  }
  const number = Number.parseInt(hex, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

export function readColors(element: Element): Colors {
  const style = getComputedStyle(element);
  const cssCache = new Map<string, string>();
  const rgbCache = new Map<string, Rgb>();
  const css = (tone: string): string => {
    const hit = cssCache.get(tone);
    if (hit) {
      return hit;
    }
    const value = style.getPropertyValue(`--px-${tone}`).trim() || FALLBACK;
    cssCache.set(tone, value);
    return value;
  };
  const rgb = (tone: string): Rgb => {
    const hit = rgbCache.get(tone);
    if (hit) {
      return hit;
    }
    const value = hexToRgb(css(tone));
    rgbCache.set(tone, value);
    return value;
  };
  return { css, rgb };
}

export function paintRows(
  ctx: CanvasRenderingContext2D,
  rows: PixelRows,
  tones: Tones,
  colors: Colors,
  x: number,
  y: number,
  isFlipped = false,
): void {
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      const symbol = row[c] ?? TRANSPARENT;
      const tone = tones[symbol];
      if (symbol === TRANSPARENT || tone === undefined) {
        c += 1;
        continue;
      }
      let end = c + 1;
      while (end < row.length && row[end] === symbol) {
        end += 1;
      }
      ctx.fillStyle = colors.css(tone);
      const left = isFlipped ? width - end : c;
      ctx.fillRect(x + left, y + r, end - c, 1);
      c = end;
    }
  });
}

export function paintCropped(
  ctx: CanvasRenderingContext2D,
  rows: PixelRows,
  tones: Tones,
  colors: Colors,
  x: number,
  y: number,
  fromRow: number,
  count: number,
): void {
  paintRows(ctx, rows.slice(fromRow, fromRow + count), tones, colors, x, y);
}

export function hash(a: number, b: number, seed = 0): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
