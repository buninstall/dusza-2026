import type { Box } from "./frame.ts";

export const TILE = 16;
export const SLACK = { x: TILE, y: TILE * 3 } as const;
export const REACH = { x: TILE, y: TILE * 3 } as const;

export type Size = { w: number; h: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Spot = readonly [number, number];

export type Metrics = {
  width: number;
  height: number;
  left: number;
  top: number;
  panelWidth: number;
  panelHeight: number;
};

export type Placement = { offsetX: number; offsetY: number; view: Size; box: Box };

function snapOffset(position: number, scale: number): number {
  return (((position % scale) + scale) % scale) - scale;
}

export function place(metrics: Metrics, scale: number): Placement {
  const offsetX = snapOffset(metrics.left, scale);
  const offsetY = snapOffset(metrics.top, scale);
  return {
    offsetX,
    offsetY,
    view: {
      w: Math.ceil((metrics.width - offsetX) / scale),
      h: Math.ceil((metrics.height - offsetY) / scale),
    },
    box: {
      x: (metrics.left - offsetX) / scale,
      y: (metrics.top - offsetY) / scale,
      w: Math.ceil(metrics.panelWidth / scale),
      h: Math.ceil(metrics.panelHeight / scale),
    },
  };
}

export function allocate(view: Size): Size {
  return { w: view.w + SLACK.x, h: view.h + SLACK.y };
}

export function fitsLive(size: Size, origin: Box, next: Placement): boolean {
  const { box, view } = next;
  return (
    view.w <= size.w &&
    view.h <= size.h &&
    box.x >= origin.x - REACH.x &&
    box.x + box.w <= origin.x + origin.w + REACH.x &&
    box.y >= origin.y - REACH.y &&
    box.y + box.h <= origin.y + origin.h + REACH.y
  );
}

export function repaintRect(previous: Box, next: Box, size: Size): Rect {
  const left = Math.min(previous.x, next.x) - 1;
  const top = Math.min(previous.y, next.y) - 1;
  const right = Math.max(previous.x + previous.w, next.x + next.w) + 1;
  const bottom = Math.max(previous.y + previous.h, next.y + next.h) + 1;
  return {
    x0: Math.max(0, Math.floor(left / TILE) * TILE),
    y0: Math.max(0, Math.floor(top / TILE) * TILE),
    x1: Math.min(size.w, Math.ceil(right / TILE) * TILE),
    y1: Math.min(size.h, Math.ceil(bottom / TILE) * TILE),
  };
}

export function lanternSpots(box: Box, isNarrow: boolean): Spot[] {
  return isNarrow
    ? [
        [box.x + 8, box.y - 10],
        [box.x + box.w - 15, box.y - 10],
      ]
    : [
        [box.x - 10, box.y + 18],
        [box.x + box.w + 3, box.y + 18],
      ];
}
