import { MINE_META } from "../../pixel/mine-art.ts";
import { BURST_ART, ORE_TONES } from "../../pixel/tiles.ts";
import type { View } from "./camera.ts";
import { rulerSpots, type SceneLayout, T } from "./layout.ts";
import { isFlagged, paintArt, paintDigits, type RulerFlags } from "./paint-world.ts";
import { flicker, isBulbOut, type Preset } from "./presets.ts";
import { type Colors, paintRows } from "./scene-art.ts";

export type Burst = { c: number; r: number; t: number };
export type Glint = { x: number; y: number; t: number };

export type EmissiveState = {
  time: number;
  isStill: boolean;
  bursts: readonly Burst[];
  glints: readonly Glint[];
  flags: RulerFlags | undefined;
};

const FLAME_FPS = 9;
const BURST_FRAME_S = 0.12;
const GLINT_S = 0.5;

function lit(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void): void {
  ctx.globalAlpha = Math.min(Math.max(alpha, 0), 1);
  draw();
  ctx.globalAlpha = 1;
}

function drawFlames(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  preset: Preset,
  state: EmissiveState,
) {
  if (preset.lanterns <= 0) {
    return;
  }
  const frame = state.isStill ? 1 : Math.floor(state.time * FLAME_FPS) % 3;
  const at = MINE_META.lantern.flame;
  const spots = [...layout.lanterns, layout.floorLamp];
  spots.forEach((spot, index) => {
    const alpha = flicker(state.time, index * 3 + 1, state.isStill) * preset.lanterns + 0.1;
    lit(ctx, alpha, () =>
      paintArt(
        ctx,
        colors,
        `flame${((frame + index) % 3) as 0 | 1 | 2}`,
        spot.x + at.x,
        spot.y + at.y,
      ),
    );
  });
}

function drawBulbs(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  preset: Preset,
  state: EmissiveState,
) {
  if (preset.bulbs > 0) {
    for (const bulb of layout.bulbs) {
      if (!isBulbOut(state.time, bulb.isFaulty, state.isStill)) {
        lit(ctx, 0.95, () => paintArt(ctx, colors, "bulbOn", bulb.x - 3, bulb.y - 2));
      }
    }
  }
  if (preset.pilot > 0) {
    lit(ctx, 0.85, () => paintArt(ctx, colors, "bulbOn", layout.pilot.x - 3, layout.pilot.y - 2));
  }
  if (preset.floods > 0) {
    for (const flood of layout.floods) {
      lit(ctx, 0.9, () => paintArt(ctx, colors, "flood", flood.x, flood.y, flood.isFlipped));
    }
  }
}

function drawRulers(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  preset: Preset,
  state: EmissiveState,
) {
  if (preset.ruler <= 0) {
    return;
  }
  for (const spot of rulerSpots(layout)) {
    const tone = isFlagged(spot, state.flags) ? "rust-lt" : "phosphor";
    lit(ctx, preset.ruler, () => paintDigits(ctx, spot, colors.css(tone)));
  }
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  state: EmissiveState,
) {
  for (const burst of state.bursts) {
    const frame = BURST_ART[Math.min(BURST_ART.length - 1, Math.floor(burst.t / BURST_FRAME_S))];
    if (frame) {
      paintRows(ctx, frame, ORE_TONES, colors, layout.bx + burst.c * T, layout.by + burst.r * T);
    }
  }
  for (const glint of state.glints) {
    const size = glint.t / GLINT_S < 0.5 ? 1 : 2 - Math.round((glint.t / GLINT_S) * 2);
    ctx.fillStyle = colors.css("glint");
    ctx.fillRect(glint.x, glint.y, 1, 1);
    if (size > 0) {
      ctx.fillStyle = colors.css("ore-hi");
      ctx.fillRect(glint.x - size, glint.y, 1, 1);
      ctx.fillRect(glint.x + size, glint.y, 1, 1);
      ctx.fillRect(glint.x, glint.y - size, 1, 1);
      ctx.fillRect(glint.x, glint.y + size, 1, 1);
    }
  }
}

export function drawEmissive(
  ctx: CanvasRenderingContext2D,
  view: View,
  layout: SceneLayout,
  colors: Colors,
  preset: Preset,
  state: EmissiveState,
): void {
  ctx.save();
  ctx.translate(-view.x, -view.y);
  drawFlames(ctx, layout, colors, preset, state);
  drawBulbs(ctx, layout, colors, preset, state);
  drawRulers(ctx, layout, colors, preset, state);
  drawSparkle(ctx, layout, colors, state);
  ctx.restore();
}
