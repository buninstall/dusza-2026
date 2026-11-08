import { MINE_ART, type MineArtName } from "../../pixel/mine-art.ts";
import {
  BEAM_H,
  BEAM_OVERHANG,
  DIGITS,
  POST_W,
  RAIL_H,
  type RulerSpot,
  rulerSpots,
  type SceneLayout,
  SILL_H,
} from "./layout.ts";
import { type Colors, hash, paintRows } from "./scene-art.ts";

const ROCK_CELL_W = 13;
const ROCK_CELL_H = 9;

export type RulerFlags = { rows: ReadonlySet<number>; cols: ReadonlySet<number> };

function nearestStone(x: number, y: number) {
  const gx = Math.floor(x / ROCK_CELL_W);
  const gy = Math.floor(y / ROCK_CELL_H);
  let d1 = Number.POSITIVE_INFINITY;
  let d2 = Number.POSITIVE_INFINITY;
  let id = 0;
  let cy = 0;
  let cx = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const nx = gx + ox;
      const ny = gy + oy;
      const fx = (nx + 0.15 + hash(nx, ny, 5) * 0.7) * ROCK_CELL_W;
      const fy = (ny + 0.15 + hash(nx, ny, 12) * 0.7) * ROCK_CELL_H;
      const d = ((x - fx) / 1.25) ** 2 + (y - fy) ** 2;
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash(nx, ny, 8);
        cx = fx;
        cy = fy;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return { edge: Math.sqrt(d2) - Math.sqrt(d1), id, cx, cy };
}

function rockTone(x: number, y: number): string {
  const stone = nearestStone(x, y);
  if (stone.edge < 1.1) {
    return "rock-dk";
  }
  const isBand = Math.sin(y / 23 + Math.sin(x / 41) * 1.3) > 0.72;
  const noise = hash(x, y, 16);
  if (stone.edge < 2.2 && y < stone.cy - 1) {
    return isBand ? "rock" : "rock-hi";
  }
  if (stone.edge < 2.2 && y > stone.cy) {
    return "rock-lo";
  }
  if (stone.id > 0.965 && Math.abs(x - stone.cx) < 2 && Math.abs(y - stone.cy) < 1.5) {
    return noise > 0.5 ? "ore-lo" : "ore";
  }
  const base = isBand || (stone.id > 0.25 && stone.id <= 0.6) ? "rock-lo" : "rock";
  if (noise > 0.93) {
    return base === "rock" ? "rock-hi" : "rock";
  }
  return noise < 0.05 ? "rock-dk" : base;
}

function groundTone(x: number, y: number, top: number): string {
  const noise = hash(x, y, 91);
  if (y - top < 1) {
    return noise > 0.5 ? "rock-hi" : "rock";
  }
  if (noise > 0.9) {
    return "rock-hi";
  }
  if (noise > 0.72) {
    return "rock";
  }
  return noise < 0.08 ? "rock-dk" : "rock-lo";
}

function paintBackdrop(ctx: CanvasRenderingContext2D, layout: SceneLayout, colors: Colors) {
  const image = ctx.createImageData(layout.W, layout.H);
  const data = image.data;
  for (let y = 0; y < layout.H; y += 1) {
    for (let x = 0; x < layout.W; x += 1) {
      const tone = y >= layout.groundY ? groundTone(x, y, layout.groundY) : rockTone(x, y);
      const [r, g, b] = colors.rgb(tone);
      const i = (y * layout.W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function paintArt(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  name: MineArtName,
  x: number,
  y: number,
  isFlipped = false,
): void {
  const art = MINE_ART[name];
  paintRows(ctx, art.rows, art.tones, colors, x, y, isFlipped);
}

function tileArt(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  name: MineArtName,
  box: { x: number; y: number; w: number; h: number },
  axis: "x" | "y",
): void {
  const art = MINE_ART[name];
  const tw = art.rows[0]?.length ?? 1;
  const th = art.rows.length;
  if (axis === "x") {
    for (let ox = 0; ox < box.w; ox += tw) {
      const rows = art.rows.map((row) => row.slice(0, Math.min(tw, box.w - ox)));
      paintRows(ctx, rows, art.tones, colors, box.x + ox, box.y);
    }
    return;
  }
  for (let oy = 0; oy < box.h; oy += th) {
    paintRows(
      ctx,
      art.rows.slice(0, Math.min(th, box.h - oy)),
      art.tones,
      colors,
      box.x,
      box.y + oy,
    );
  }
}

function paintCable(ctx: CanvasRenderingContext2D, layout: SceneLayout, colors: Colors) {
  for (let i = 0; i < layout.hooks.length - 1; i += 1) {
    const a = layout.hooks[i] ?? 0;
    const b = layout.hooks[i + 1] ?? a;
    for (let x = a; x <= b; x += 1) {
      const sag = Math.round(Math.sin(((x - a) / (b - a)) * Math.PI) * 6);
      ctx.fillStyle = colors.css("iron-lt");
      ctx.fillRect(x, layout.cableY + sag, 1, 1);
      ctx.fillStyle = colors.css("iron-edge");
      ctx.fillRect(x, layout.cableY + sag + 1, 1, 1);
    }
  }
  for (const x of layout.hooks) {
    ctx.fillStyle = colors.css("iron-hi");
    ctx.fillRect(x - 1, layout.cableY - 2, 2, 2);
  }
}

function paintFrame(ctx: CanvasRenderingContext2D, layout: SceneLayout, colors: Colors) {
  const postH = layout.railY - layout.beamY;
  for (const x of [layout.postL, layout.postR]) {
    tileArt(ctx, colors, "postMid", { x, y: layout.beamY, w: POST_W, h: postH }, "y");
    paintArt(ctx, colors, "postCap", x, layout.by - 1);
    paintArt(ctx, colors, "postFoot", x, layout.railY - 2);
  }
  const beamX0 = layout.postL - BEAM_OVERHANG;
  const beamX1 = layout.postR + POST_W + BEAM_OVERHANG;
  tileArt(
    ctx,
    colors,
    "beamMid",
    { x: beamX0, y: layout.beamY, w: beamX1 - beamX0, h: BEAM_H },
    "x",
  );
  paintArt(ctx, colors, "beamEnd", beamX0 - BEAM_OVERHANG, layout.beamY, true);
  paintArt(ctx, colors, "beamEnd", beamX1, layout.beamY);
  const sillW = layout.postR + POST_W - layout.postL;
  tileArt(ctx, colors, "sillMid", { x: layout.postL, y: layout.sillY, w: sillW, h: SILL_H }, "x");
  tileArt(ctx, colors, "railMid", { x: 0, y: layout.railY, w: layout.W, h: RAIL_H }, "x");
  for (const lantern of layout.lanterns) {
    ctx.fillStyle = colors.css("iron-md");
    ctx.fillRect(lantern.armX0, lantern.y - 4, lantern.armX1 - lantern.armX0, 2);
    ctx.fillStyle = colors.css("iron-edge");
    ctx.fillRect(lantern.armX0, lantern.y - 2, lantern.armX1 - lantern.armX0, 1);
  }
}

function paintProps(ctx: CanvasRenderingContext2D, layout: SceneLayout, colors: Colors) {
  const g = layout.groundY;
  paintArt(ctx, colors, "pickaxe", layout.postL - 22, g - 12);
  paintArt(ctx, colors, "bucket", layout.postL - 38, g - 4);
  paintArt(ctx, colors, "rubble0", layout.postL - 74, g + 1);
  paintArt(ctx, colors, "crate", layout.cart.x + 34, g - 7);
  paintArt(ctx, colors, "rubble1", layout.cart.x + 52, g + 1);
  paintArt(ctx, colors, "rubble2", layout.postR + 4, g + 2);
  paintArt(ctx, colors, "shovel", layout.postR + POST_W + 2, layout.sillY - 11);
}

export function paintDigits(
  ctx: CanvasRenderingContext2D,
  spot: RulerSpot,
  color: string,
  dx = 0,
  dy = 0,
): void {
  ctx.fillStyle = color;
  [...spot.text].forEach((ch, index) => {
    (DIGITS[ch] ?? []).forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell === "#") {
          ctx.fillRect(spot.x + dx + index * 4 + rx, spot.y + dy + ry, 1, 1);
        }
      });
    });
  });
}

export function isFlagged(spot: RulerSpot, flags: RulerFlags | undefined): boolean {
  return (spot.axis === "col" ? flags?.cols : flags?.rows)?.has(spot.index) ?? false;
}

export function paintRulers(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  flags: RulerFlags | undefined,
): void {
  for (const spot of rulerSpots(layout)) {
    paintDigits(ctx, spot, colors.css("wood-dk"), 1, 1);
    paintDigits(ctx, spot, colors.css(isFlagged(spot, flags) ? "rust-lt" : "phosphor"));
  }
}

export function paintWorld(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
): void {
  paintBackdrop(ctx, layout, colors);
  paintCable(ctx, layout, colors);
  paintFrame(ctx, layout, colors);
  paintProps(ctx, layout, colors);
}
