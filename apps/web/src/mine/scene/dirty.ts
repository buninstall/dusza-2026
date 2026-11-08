import type { View } from "./camera.ts";
import { type SceneLayout, T } from "./layout.ts";
import type { BlockRect } from "./light.ts";
import type { ViewRect } from "./shade.ts";

export type WorldRect = { x0: number; y0: number; x1: number; y1: number };

const FULL_SHARE = 0.8;

export function viewWorldRect(view: View): WorldRect {
  return { x0: view.x, y0: view.y, x1: view.x + view.width, y1: view.y + view.height };
}

export function toViewRect(rect: WorldRect, view: View): ViewRect | null {
  const x0 = Math.max(0, Math.floor(rect.x0 - view.x));
  const y0 = Math.max(0, Math.floor(rect.y0 - view.y));
  const x1 = Math.min(view.width, Math.ceil(rect.x1 - view.x));
  const y1 = Math.min(view.height, Math.ceil(rect.y1 - view.y));
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

export function toBlockRect(rect: ViewRect, view: View): BlockRect {
  return {
    x0: ((view.x + rect.x0) >> 1) - 1,
    y0: ((view.y + rect.y0) >> 1) - 1,
    x1: ((view.x + rect.x1) >> 1) + 1,
    y1: ((view.y + rect.y1) >> 1) + 1,
  };
}

export function tileRect(layout: SceneLayout, index: number): WorldRect {
  const x0 = layout.bx + (index % layout.cols) * T;
  const y0 = layout.by + Math.floor(index / layout.cols) * T;
  return { x0, y0, x1: x0 + T, y1: y0 + T };
}

export function pointRect(x: number, y: number, pad: number): WorldRect {
  return { x0: x - pad, y0: y - pad, x1: x + pad + 1, y1: y + pad + 1 };
}

export function viewRects(rects: readonly WorldRect[], view: View): ViewRect[] {
  const clipped = rects.flatMap((rect) => {
    const next = toViewRect(rect, view);
    return next ? [next] : [];
  });
  const area = clipped.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
  if (area > view.width * view.height * FULL_SHARE) {
    return [{ x0: 0, y0: 0, x1: view.width, y1: view.height }];
  }
  return clipped;
}
