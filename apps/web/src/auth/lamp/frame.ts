import type { PixelRows } from "../../pixel/pixel-art.ts";
import { drawRows, type Palette, signRows, toneColor } from "./canvas-art.ts";

export const FRAME = { side: 7, top: 12, bottom: 10 } as const;

export type Box = { x: number; y: number; w: number; h: number };

const HAZARD_PERIOD = 8;
const RIVET_STEP = 16;

export const LANTERN_ART: PixelRows = [
  "..kkk..",
  ".k...k.",
  "kkkkkkk",
  "kLLwLLk",
  "kLwwwLk",
  "kLLwLLk",
  "kkkkkkk",
];

export const LANTERN_TONES = { k: "steel-edge", L: "beam", w: "glint" } as const;
export const LANTERN_DIM_TONES = { k: "steel-edge", L: "ore-lo", w: "ore" } as const;

export function paintFrame(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  box: Box,
  plate: string,
): void {
  const { x, y, w, h } = box;
  const fill = (tone: string, fx: number, fy: number, fw: number, fh: number) => {
    ctx.fillStyle = toneColor(palette, tone);
    ctx.fillRect(fx, fy, fw, fh);
  };
  fill("steel-edge", x - 1, y - 1, w + 2, h + 2);
  fill("steel-lo", x, y, w, h);
  fill("steel", x, y, w, 1);
  fill("steel", x, y, 1, h);
  fill("tread", x, y + h - 1, w, 1);
  fill("tread", x + w - 1, y, 1, h);

  const inner = {
    x: x + FRAME.side,
    y: y + FRAME.top,
    w: w - FRAME.side * 2,
    h: h - FRAME.top - FRAME.bottom,
  };
  fill("steel-edge", inner.x - 1, inner.y - 1, inner.w + 2, inner.h + 2);
  fill("void", inner.x, inner.y, inner.w, inner.h);

  const hx = x + 3;
  const hy = y + 3;
  const hw = w - 6;
  fill("steel-edge", hx - 1, hy - 1, hw + 2, 6);
  for (let px = 0; px < hw; px += 1) {
    for (let py = 0; py < 4; py += 1) {
      fill((px + py) % HAZARD_PERIOD < HAZARD_PERIOD / 2 ? "alert" : "alert-ink", hx + px, hy + py, 1, 1);
    }
  }

  const rivet = (rx: number, ry: number) => {
    fill("steel-hi", rx, ry, 1, 1);
    fill("steel", rx + 1, ry, 1, 1);
    fill("steel", rx, ry + 1, 1, 1);
    fill("steel-edge", rx + 1, ry + 1, 1, 1);
  };
  for (let ry = inner.y + 4; ry < inner.y + inner.h - 4; ry += RIVET_STEP) {
    rivet(x + 2, ry);
    rivet(x + w - 4, ry);
  }
  for (let rx = x + 10; rx < x + w - 10; rx += RIVET_STEP) {
    rivet(rx, y + h - 6);
  }

  const sign = signRows(plate).slice(2);
  const signWidth = sign[0]?.length ?? 0;
  const sx = Math.round(x + w / 2 - signWidth / 2);
  const sy = y + h - 9;
  fill("tread", sx - 3, sy - 1, signWidth + 6, 9);
  fill("steel-edge", sx - 3, sy + 7, signWidth + 6, 1);
  fill("tread", sx - 6, y + h - 6, 4, 2);
  fill("tread", sx + signWidth + 2, y + h - 6, 4, 2);
  drawRows(ctx, sign, { "#": "steel-hi" }, palette, sx, sy);
}
