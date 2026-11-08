import type { Box, Point } from "./layout.ts";

export const MAX_SCALE = 16;

export type Viewport = { width: number; height: number };

export type View = { scale: number; x: number; y: number; width: number; height: number };

export function fitScale(frame: Box, viewport: Viewport, quantum = 1): number {
  const width = frame.x1 - frame.x0;
  const height = frame.y1 - frame.y0;
  if (width <= 0 || height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return 1;
  }
  const ratio = Math.min(viewport.width / width, viewport.height / height);
  const scale = Math.floor(ratio / quantum) * quantum;
  return Math.min(Math.max(scale, 1), MAX_SCALE);
}

export function zoomScale(fit: number, zoom: number, quantum = 1): number {
  const scale = Math.round((fit * zoom) / quantum) * quantum;
  return Math.min(Math.max(scale, 1), MAX_SCALE);
}

export function windowSize(viewport: Viewport, scale: number): { width: number; height: number } {
  return {
    width: Math.ceil(viewport.width / scale),
    height: Math.ceil(viewport.height / scale),
  };
}

function clampAxis(start: number, size: number, worldSize: number): number {
  if (size >= worldSize) {
    return Math.round((worldSize - size) / 2);
  }
  return Math.min(Math.max(start, 0), worldSize - size);
}

export function placeView(
  center: Point,
  viewport: Viewport,
  scale: number,
  world: { width: number; height: number },
): View {
  const size = windowSize(viewport, scale);
  return {
    scale,
    width: size.width,
    height: size.height,
    x: clampAxis(Math.round(center.x - size.width / 2), size.width, world.width),
    y: clampAxis(Math.round(center.y - size.height / 2), size.height, world.height),
  };
}

export function frameCenter(frame: Box): Point {
  return { x: (frame.x0 + frame.x1) / 2, y: (frame.y0 + frame.y1) / 2 };
}

export function viewCenter(view: View): Point {
  return { x: view.x + view.width / 2, y: view.y + view.height / 2 };
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

export function followCenter(center: Point, view: View, target: Box, margin: number): Point {
  let { x, y } = center;
  const left = view.x + margin;
  const right = view.x + view.width - margin;
  const top = view.y + margin;
  const bottom = view.y + view.height - margin;
  if (target.x0 < left) {
    x -= left - target.x0;
  } else if (target.x1 > right) {
    x += target.x1 - right;
  }
  if (target.y0 < top) {
    y -= top - target.y0;
  } else if (target.y1 > bottom) {
    y += target.y1 - bottom;
  }
  return { x, y };
}
