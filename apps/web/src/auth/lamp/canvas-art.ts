import { type PixelRows, TRANSPARENT } from "../../pixel/pixel-art.ts";

export type Tones = Readonly<Record<string, string>>;
export type Palette = Readonly<Record<string, string>>;

const PALETTE_TONES = [
  "void",
  "floor",
  "floor-lo",
  "floor-hi",
  "seam",
  "dug",
  "wall",
  "wall-hi",
  "wall-lo",
  "mortar",
  "ore",
  "ore-hi",
  "ore-lo",
  "ore-edge",
  "glint",
  "steel-hi",
  "steel",
  "steel-lo",
  "steel-edge",
  "tread",
  "tread-hi",
  "visor",
  "lamp",
  "beam",
  "alert",
  "alert-ink",
] as const;

const FALLBACK = "#000000";

export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  return Object.fromEntries(
    PALETTE_TONES.map((tone) => [tone, style.getPropertyValue(`--px-${tone}`).trim() || FALLBACK]),
  );
}

export function toneColor(palette: Palette, tone: string): string {
  return palette[tone] ?? FALLBACK;
}

export function drawRows(
  ctx: CanvasRenderingContext2D,
  rows: PixelRows,
  tones: Tones,
  palette: Palette,
  x: number,
  y: number,
): void {
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
      ctx.fillStyle = toneColor(palette, tone);
      ctx.fillRect(x + c, y + r, end - c, 1);
      c = end;
    }
  });
}

export function spriteCanvas(rows: PixelRows, tones: Tones, palette: Palette): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = rows[0]?.length ?? 1;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    drawRows(ctx, rows, tones, palette, 0, 0);
  }
  return canvas;
}
