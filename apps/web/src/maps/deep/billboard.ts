import { type Box, hash, noise, PANEL, type Point, TIMBER, type World } from "./world.ts";

const POST_W = 4;
const BORDER = 4;
const RIVET_STEP = 14;
const POST_SINK = 4;

function post(world: World, x: number, top: number, bottom: number): void {
  for (let y = top; y < bottom; y += 1) {
    world.put(x, y, "iron-hi");
    world.put(x + 1, y, "iron");
    world.put(x + 2, y, "iron");
    world.put(x + 3, y, "iron-dk");
    if (hash(x, y) > 0.72) world.put(x + 1 + (y % 2), y, hash(y, x) > 0.5 ? "rust" : "rust-lo");
  }
  world.rect(x - 1, bottom - POST_SINK, POST_W + 2, 1, "rubble-lo");
  world.setMask(x, top, POST_W, bottom - top, TIMBER);
}

function rivet(world: World, x: number, y: number, isRusty: boolean): void {
  world.put(x, y, "iron-hi");
  world.put(x + 1, y, "iron");
  world.put(x, y + 1, "iron");
  world.put(x + 1, y + 1, "iron-dk");
  if (!isRusty) return;
  const len = 2 + Math.floor(hash(x, y) * 5);
  for (let k = 0; k < len; k += 1)
    world.put(x + (k > 2 ? 1 : 0), y + 2 + k, k < 2 ? "rust-hi" : "rust");
}

function plate(world: World, b: Box): void {
  for (let y = b.y; y < b.y + b.h; y += 1) {
    for (let x = b.x; x < b.x + b.w; x += 1) {
      const isEdge =
        x < b.x + BORDER || x >= b.x + b.w - BORDER || y < b.y + BORDER || y >= b.y + b.h - BORDER;
      const n = noise(x, y, 6) * 0.6 + noise(x, y, 2) * 0.4;
      if (isEdge) {
        world.put(x, y, n > 0.62 ? "rust-hi" : n > 0.42 ? "rust" : "iron");
      } else {
        world.put(x, y, n > 0.7 ? "rust-lo" : n > 0.35 ? "iron-dk" : "iron-lo");
      }
    }
  }
  world.rect(b.x, b.y, b.w, 1, "iron-hi");
  world.rect(b.x, b.y, 1, b.h, "iron-hi");
  world.rect(b.x, b.y + b.h - 1, b.w, 1, "iron-dk");
  world.rect(b.x + b.w - 1, b.y, 1, b.h, "iron-dk");
  world.rect(b.x + BORDER, b.y + BORDER, b.w - BORDER * 2, 1, "iron-dk");
  world.rect(b.x + BORDER, b.y + b.h - BORDER - 1, b.w - BORDER * 2, 1, "iron");
  for (let x = b.x + 3; x < b.x + b.w - 3; x += RIVET_STEP) {
    rivet(world, x, b.y + 1, hash(x, 1) > 0.4);
    rivet(world, x, b.y + b.h - 3, false);
  }
  for (let y = b.y + RIVET_STEP; y < b.y + b.h - 6; y += RIVET_STEP) {
    rivet(world, b.x + 1, y, hash(y, 2) > 0.5);
    rivet(world, b.x + b.w - 3, y, hash(y, 3) > 0.5);
  }
  for (let k = 0; k < Math.round(b.w / 18); k += 1) {
    const x = b.x + BORDER + Math.floor(hash(k, b.w) * (b.w - BORDER * 2));
    const len = 3 + Math.floor(hash(b.w, k) * 6);
    for (let d = 0; d < len; d += 1)
      world.put(x, b.y + BORDER + d, d < len / 2 ? "rust" : "rust-lo");
  }
}

export function billboard(world: World, b: Box, groundY: number): Point {
  const bottom = b.y + b.h;
  post(world, b.x + 14, bottom, groundY + POST_SINK);
  post(world, b.x + b.w - 18, bottom, groundY + POST_SINK);
  plate(world, b);
  const lamp = { x: Math.round(b.x + b.w / 2) - 2, y: b.y - 7 };
  world.rect(lamp.x - 6, b.y - 2, 15, 1, "iron");
  world.rect(lamp.x + 2, lamp.y + 2, 1, 4, "iron-dk");
  world.setMask(b.x, b.y, b.w, b.h, PANEL);
  return lamp;
}
