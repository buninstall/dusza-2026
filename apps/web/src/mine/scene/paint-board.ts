import type { MineMap } from "@minescript/engine";
import { CRACKED_FLOOR_ART, PEBBLE_FLOOR_ART } from "../../pixel/cave-art.ts";
import { MINE_ART } from "../../pixel/mine-art.ts";
import type { PixelRows } from "../../pixel/pixel-art.ts";
import { DUG_ART, FLOOR_ART, FLOOR_TONES, GOLD_ART, ORE_TONES } from "../../pixel/tiles.ts";
import { type Exploration, posKey, type TileKind, tileKind } from "../tiles-model.ts";
import { type SceneLayout, T } from "./layout.ts";
import { type Colors, hash, paintCropped, paintRows } from "./scene-art.ts";

export const FACE_FLAT = 0;
export const FACE_TOP = 1;
export const FACE_FRONT = 2;
export const FACE_SHADE = 3;

export const SIGHT_KNOWN = 0;
export const SIGHT_SHROUD = 1;
export const SIGHT_HIDDEN = 2;

const TOP_ROWS = 10;
const DUG_TONES = { p: "dug", l: "floor-lo" } as const;
const FLOORS: readonly PixelRows[] = [...FLOOR_ART, PEBBLE_FLOOR_ART, CRACKED_FLOOR_ART];
const DECALS = [MINE_ART.decal0, MINE_ART.decal1, MINE_ART.decal2] as const;
const TOPS = [MINE_ART.wallTop0, MINE_ART.wallTop1, MINE_ART.wallTop2] as const;
const FRONTS = [MINE_ART.wallFace0, MINE_ART.wallFace1] as const;

export function kindsOf(map: MineMap, exploration: Exploration | null): TileKind[] {
  return map.cells.flatMap((row, r) =>
    row.map((cell, c) =>
      tileKind(cell, exploration?.mined.has(posKey({ row: r, col: c })) ?? false),
    ),
  );
}

export function seedSeen(
  seen: Uint8Array,
  map: MineMap,
  exploration: Exploration | null,
  robotKey: string | null,
): void {
  for (let r = 0; r < map.rows; r += 1) {
    for (let c = 0; c < map.cols; c += 1) {
      const key = posKey({ row: r, col: c });
      if (key === robotKey || exploration?.discovered.has(key)) {
        seen[r * map.cols + c] = 1;
      }
    }
  }
}

export function sightFromSeen(
  seen: Uint8Array,
  isAllKnown: boolean,
  isVeiled: boolean,
): Uint8Array {
  const veiled = isVeiled ? SIGHT_SHROUD : SIGHT_HIDDEN;
  return seen.map((value) => (isAllKnown || value > 0 ? SIGHT_KNOWN : veiled));
}

function isWallAt(kinds: readonly TileKind[], cols: number, rows: number, c: number, r: number) {
  return c >= 0 && r >= 0 && c < cols && r < rows && kinds[r * cols + c] === "wall";
}

function mark(
  face: Uint8Array,
  width: number,
  box: { x: number; y: number; w: number; h: number },
  kind: number,
  isDithered = false,
) {
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) {
      if (isDithered && (x + y) % 2 === 1 && y > box.y) {
        continue;
      }
      face[y * width + x] = kind;
    }
  }
}

type BoardCtx = {
  ctx: CanvasRenderingContext2D;
  colors: Colors;
  face: Uint8Array;
  layout: SceneLayout;
  kinds: readonly TileKind[];
};

function paintFloor(board: BoardCtx, c: number, r: number, x: number, y: number) {
  const { ctx, colors } = board;
  const variant = Math.floor(hash(c, r, 3) * FLOORS.length);
  paintRows(ctx, FLOORS[variant] ?? FLOORS[0] ?? [], FLOOR_TONES, colors, x, y);
  const roll = hash(c, r, 17);
  const decal = roll < 0.3 ? DECALS[Math.floor(roll * 10) % DECALS.length] : undefined;
  if (decal) {
    paintRows(ctx, decal.rows, decal.tones, colors, x, y);
  }
}

function paintWall(board: BoardCtx, c: number, r: number, x: number, y: number) {
  const { ctx, colors, face, layout, kinds } = board;
  const { cols, rows, W } = layout;
  const hasFace = !isWallAt(kinds, cols, rows, c, r + 1);
  const topRows = hasFace ? TOP_ROWS : T;
  const top = TOPS[Math.floor(hash(c, r, 5) * TOPS.length)] ?? TOPS[0];
  paintCropped(ctx, top.rows, top.tones, colors, x, y, 0, topRows);
  mark(face, W, { x, y, w: T, h: topRows }, FACE_TOP);
  if (hasFace) {
    const front = FRONTS[Math.floor(hash(c, r, 9) * FRONTS.length)] ?? FRONTS[0];
    paintCropped(ctx, front.rows, front.tones, colors, x, y + TOP_ROWS, 0, T - TOP_ROWS);
    mark(face, W, { x, y: y + TOP_ROWS, w: T, h: T - TOP_ROWS }, FACE_FRONT);
  }
  ctx.fillStyle = colors.css("mortar");
  if (!isWallAt(kinds, cols, rows, c, r - 1)) {
    ctx.fillRect(x, y, T, 1);
  }
  if (!isWallAt(kinds, cols, rows, c - 1, r)) {
    ctx.fillRect(x, y, 1, topRows);
  }
  if (!isWallAt(kinds, cols, rows, c + 1, r)) {
    ctx.fillRect(x + T - 1, y, 1, topRows);
  }
}

function paintContact(board: BoardCtx, c: number, r: number, x: number, y: number) {
  const { face, layout, kinds } = board;
  if (r === 0) {
    mark(face, layout.W, { x, y, w: T, h: 2 }, FACE_SHADE, true);
  }
  if (isWallAt(kinds, layout.cols, layout.rows, c, r - 1)) {
    mark(face, layout.W, { x, y, w: T, h: 3 }, FACE_SHADE, true);
  }
  if (isWallAt(kinds, layout.cols, layout.rows, c - 1, r)) {
    mark(face, layout.W, { x, y, w: 2, h: T }, FACE_SHADE, true);
  }
}

export function paintBoard(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  colors: Colors,
  kinds: readonly TileKind[],
  face: Uint8Array,
): void {
  const board: BoardCtx = { ctx, colors, face, layout, kinds };
  for (let y = layout.by; y < layout.by + layout.bh; y += 1) {
    face.fill(FACE_FLAT, y * layout.W + layout.bx, y * layout.W + layout.bx + layout.bw);
  }
  for (let r = 0; r < layout.rows; r += 1) {
    for (let c = 0; c < layout.cols; c += 1) {
      const x = layout.bx + c * T;
      const y = layout.by + r * T;
      const kind = kinds[r * layout.cols + c];
      if (kind === "wall") {
        paintWall(board, c, r, x, y);
        continue;
      }
      paintFloor(board, c, r, x, y);
      if (kind === "gold") {
        paintRows(ctx, GOLD_ART, ORE_TONES, colors, x, y);
      }
      if (kind === "mined") {
        paintRows(ctx, DUG_ART, DUG_TONES, colors, x, y);
      }
      paintContact(board, c, r, x, y);
    }
  }
}
