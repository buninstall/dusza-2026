import type { Pos } from "@minescript/engine";
import { type SceneLayout, T } from "./layout.ts";
import { SIGHT_KNOWN } from "./paint-board.ts";
import type { Colors } from "./scene-art.ts";

export type GhostPath = {
  path: readonly Pos[];
  mined: readonly Pos[];
  end: Pos | null;
  isError: boolean;
};

const DOT_STEP = 3;
const DOT_ALPHA = 0.62;
const MARK_ALPHA = 0.9;
const HALF = T / 2;

function isShown(layout: SceneLayout, sight: Uint8Array, pos: Pos): boolean {
  return sight[pos.row * layout.cols + pos.col] === SIGHT_KNOWN;
}

function drawSegment(ctx: CanvasRenderingContext2D, layout: SceneLayout, from: Pos, to: Pos) {
  const x0 = layout.bx + from.col * T + HALF;
  const y0 = layout.by + from.row * T + HALF;
  const x1 = layout.bx + to.col * T + HALF;
  const y1 = layout.by + to.row * T + HALF;
  const length = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let d = 0; d <= length; d += DOT_STEP) {
    const t = length === 0 ? 0 : d / length;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
  }
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number) {
  for (let d = -2; d <= 2; d += 1) {
    ctx.fillRect(x + d, y + d, 1, 1);
    ctx.fillRect(x + d, y - d, 1, 1);
  }
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillRect(x - 1, y - 3, 3, 1);
  ctx.fillRect(x - 1, y + 3, 3, 1);
  ctx.fillRect(x - 3, y - 1, 1, 3);
  ctx.fillRect(x + 3, y - 1, 1, 3);
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  sight: Uint8Array,
  ghost: GhostPath,
): void {
  ctx.save();
  ctx.globalAlpha = DOT_ALPHA;
  ctx.fillStyle = colors.css("phosphor");
  for (let i = 1; i < ghost.path.length; i += 1) {
    const from = ghost.path[i - 1];
    const to = ghost.path[i];
    if (from && to && isShown(layout, sight, from) && isShown(layout, sight, to)) {
      drawSegment(ctx, layout, from, to);
    }
  }
  ctx.globalAlpha = MARK_ALPHA;
  ctx.fillStyle = colors.css("ore-hi");
  for (const pos of ghost.mined) {
    if (isShown(layout, sight, pos)) {
      drawRing(ctx, layout.bx + pos.col * T + HALF, layout.by + pos.row * T + HALF);
    }
  }
  if (ghost.end && isShown(layout, sight, ghost.end)) {
    ctx.fillStyle = colors.css(ghost.isError ? "rust-lt" : "phosphor");
    const x = layout.bx + ghost.end.col * T + HALF;
    const y = layout.by + ghost.end.row * T + HALF;
    if (ghost.isError) {
      drawCross(ctx, x, y);
    } else {
      drawRing(ctx, x, y);
    }
  }
  ctx.restore();
}
