import { MINE_ART, MINE_META } from "../../pixel/mine-art.ts";
import type { SceneLayout } from "./layout.ts";
import { paintArt } from "./paint-world.ts";
import type { Preset } from "./presets.ts";
import { type Colors, paintRows } from "./scene-art.ts";

const CART_LEVELS = 3;
const CHAIN_STEP = 4;

export function cartLevel(mined: number, total: number): number {
  if (total <= 0 || mined <= 0) {
    return 0;
  }
  return Math.min(CART_LEVELS, Math.max(1, Math.ceil((mined / total) * CART_LEVELS)));
}

function paintLanterns(ctx: CanvasRenderingContext2D, layout: SceneLayout, colors: Colors) {
  const chain = MINE_ART.chain;
  for (const lantern of layout.lanterns) {
    for (let y = lantern.y - CHAIN_STEP; y < lantern.y; y += CHAIN_STEP) {
      paintRows(ctx, chain.rows, chain.tones, colors, lantern.x + 4, y);
    }
    paintArt(ctx, colors, "lantern", lantern.x, lantern.y);
  }
  paintArt(ctx, colors, "lantern", layout.floorLamp.x, layout.floorLamp.y);
}

function paintPilot(ctx: CanvasRenderingContext2D, layout: SceneLayout, colors: Colors) {
  const { x, y } = layout.pilot;
  ctx.fillStyle = colors.css("cable");
  ctx.fillRect(x, y - 6, 1, 5);
  ctx.fillStyle = colors.css("iron-hi");
  ctx.fillRect(x - 1, y - 7, 3, 1);
  paintArt(ctx, colors, "bulbOff", x - 3, y - 2);
}

function paintCart(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  level: number,
) {
  const { x, y } = layout.cart;
  if (level > 0) {
    const at = MINE_META.cart.load;
    paintArt(ctx, colors, `cartLoad${level as 1 | 2 | 3}`, x + at.x, y + at.y);
  }
  paintArt(ctx, colors, "cart", x, y);
}

export function paintFixtures(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  preset: Preset,
  cart: number,
): void {
  for (const bulb of layout.bulbs) {
    paintArt(ctx, colors, "bulbOff", bulb.x - 3, bulb.y - 2);
  }
  paintLanterns(ctx, layout, colors);
  paintPilot(ctx, layout, colors);
  paintCart(ctx, layout, colors, cart);
  if (preset.floods > 0) {
    for (const flood of layout.floods) {
      paintArt(ctx, colors, "flood", flood.x, flood.y, flood.isFlipped);
    }
  }
}
