import type { Box, Point } from "./layout.ts";

export const MAX_SCALE = 16;
export const SMALL_MAP = 8;
export const SMALL_MAP_SHRINK = 0.7;
export const SHRINK_FADE_CELLS = 5;

export type Viewport = { width: number; height: number };

export type View = {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fx: number;
  fy: number;
  spanW: number;
  spanH: number;
};

export function fitRatio(frame: Box, viewport: Viewport): number {
  const width = frame.x1 - frame.x0;
  const height = frame.y1 - frame.y0;
  if (width <= 0 || height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return 1;
  }
  return Math.min(viewport.width / width, viewport.height / height);
}

export function fitScale(frame: Box, viewport: Viewport, quantum = 1): number {
  const ratio = fitRatio(frame, viewport);
  const scale = Math.floor(ratio / quantum) * quantum;
  return Math.min(Math.max(scale, 1), MAX_SCALE);
}

export function shrinkFactor(longest: number): number {
  const beyond = Math.max(0, longest - SMALL_MAP);
  return Math.min(1, SMALL_MAP_SHRINK + ((1 - SMALL_MAP_SHRINK) * beyond) / SHRINK_FADE_CELLS);
}

export function restingScale(fit: number, longest: number, quantum = 1, ratio = fit): number {
  const factor = shrinkFactor(longest);
  if (factor >= 1) {
    return fit;
  }
  const shrunk = Math.floor((ratio * factor) / quantum) * quantum;
  return Math.min(Math.max(shrunk, 1), fit);
}

export const TARGET_MIN_PX = 24;

export function targetScale(tile: number, quantum = 1): number {
  return Math.ceil(TARGET_MIN_PX / tile / quantum) * quantum;
}

export function zoomScale(fit: number, zoom: number, quantum = 1): number {
  const rounded = Math.round((fit * zoom) / quantum) * quantum;
  const scale =
    zoom > 1
      ? Math.max(rounded, fit + quantum)
      : zoom < 1
        ? Math.min(rounded, fit - quantum)
        : rounded;
  return Math.min(Math.max(scale, 1), MAX_SCALE);
}

export function windowSize(viewport: Viewport, scale: number): { width: number; height: number } {
  return {
    width: Math.ceil(viewport.width / scale),
    height: Math.ceil(viewport.height / scale),
  };
}

function clampAxis(start: number, span: number, worldSize: number): number {
  if (span >= worldSize) {
    return (worldSize - span) / 2;
  }
  return Math.min(Math.max(start, 0), worldSize - span);
}

export function placeView(
  center: Point,
  viewport: Viewport,
  scale: number,
  world: { width: number; height: number },
): View {
  const spanW = viewport.width / scale;
  const spanH = viewport.height / scale;
  const startX = clampAxis(center.x - spanW / 2, spanW, world.width);
  const startY = clampAxis(center.y - spanH / 2, spanH, world.height);
  const x = Math.floor(startX);
  const y = Math.floor(startY);
  return {
    scale,
    x,
    y,
    fx: startX - x,
    fy: startY - y,
    spanW,
    spanH,
    width: Math.ceil(spanW) + 1,
    height: Math.ceil(spanH) + 1,
  };
}

export function frameCenter(frame: Box): Point {
  return { x: (frame.x0 + frame.x1) / 2, y: (frame.y0 + frame.y1) / 2 };
}

export function viewCenter(view: View): Point {
  return { x: view.x + view.fx + view.spanW / 2, y: view.y + view.fy + view.spanH / 2 };
}

export function anchorCenter(
  center: Point,
  anchor: Point,
  fromScale: number,
  toScale: number,
): Point {
  const ratio = fromScale / toScale;
  return {
    x: anchor.x + (center.x - anchor.x) * ratio,
    y: anchor.y + (center.y - anchor.y) * ratio,
  };
}
