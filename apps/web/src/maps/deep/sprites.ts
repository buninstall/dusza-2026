import { spriteCanvas } from "../../auth/lamp/canvas-art.ts";
import type { Light } from "../../auth/lamp/lighting.ts";
import { mirror } from "../../pixel/pixel-art.ts";
import { ROBOT_TONES } from "../../pixel/tiles.ts";
import type { View } from "./view.ts";
import { type CrystalKind, SKY, toneHex, type World } from "./world.ts";

const ROBOT_SIDE = [
  "................",
  "......kk........",
  ".....kaak.......",
  "......kk....kkk.",
  "...kkkkkkkkkLLk.",
  "..keeeeeeeeekkk.",
  "..keaaaaaakvvvk.",
  "..kaaaaaaakvvvk.",
  "..kaadaadaaaaak.",
  "..kddddddddddk..",
  ".kkkkkkkkkkkkkk.",
  "ktrrtrrtrrtrrtk.",
  ".kkkkkkkkkkkkk..",
];

const ROBOT_SIDE_B = ROBOT_SIDE.map((row, i) => (i === 11 ? "krtrrtrrtrrtrrk." : row));

const CART_ART = [
  "kkkkkkkkkkkkkk",
  "kaddddddddddak",
  "kdaaaaaaaaaadk",
  ".kdaaaaaaaadk.",
  ".kkkkkkkkkkkk.",
];

const LANTERN_ART = ["..k..", ".kkk.", "kLwLk", "kLLLk", ".kkk."];

const PILE: readonly [number, number][] = [
  [5, 1],
  [6, 1],
  [7, 1],
  [8, 1],
  [3, 1],
  [4, 1],
  [9, 1],
  [10, 1],
  [6, 0],
  [7, 0],
  [5, 0],
  [8, 0],
];

export type LanternState = "on" | "dim" | "off";
export type Face = "left" | "right";
export type RobotPose = { x: number; y: number; face: Face; travel: number; isMining: boolean };

export type Sprites = {
  robot: Record<Face, HTMLCanvasElement[]>;
  lantern: Record<LanternState, HTMLCanvasElement>;
  cart: HTMLCanvasElement;
  tone: (name: string) => string;
};

export function createSprites(world: World): Sprites {
  const robotTones = Object.fromEntries(Object.entries(ROBOT_TONES).filter(([key]) => key !== "B"));
  const p = world.palette;
  return {
    robot: {
      right: [ROBOT_SIDE, ROBOT_SIDE_B].map((art) => spriteCanvas(art, robotTones, p)),
      left: [ROBOT_SIDE, ROBOT_SIDE_B].map((art) => spriteCanvas(mirror(art), robotTones, p)),
    },
    lantern: {
      on: spriteCanvas(LANTERN_ART, { k: "steel-edge", L: "beam", w: "glint" }, p),
      dim: spriteCanvas(LANTERN_ART, { k: "steel-edge", L: "lantern-dim", w: "lantern-dim-hi" }, p),
      off: spriteCanvas(LANTERN_ART, { k: "steel-edge", L: "lantern-off", w: "lantern-off-hi" }, p),
    },
    cart: spriteCanvas(CART_ART, robotTones, p),
    tone: (name) => toneHex(p, name),
  };
}

export function drawRobot(view: View, sprites: Sprites, pose: RobotPose, time: number): void {
  const { ctx } = view;
  const frame = Math.floor(pose.travel / 3) % 2;
  const sprite = sprites.robot[pose.face][frame];
  const bob = pose.isMining && Math.floor(time * 16) % 2 ? 1 : 0;
  const x = view.snap(pose.x);
  const y = view.snap(pose.y) - view.camY + bob;
  if (sprite) ctx.drawImage(sprite, x, y);
  ctx.fillStyle = sprites.tone("glint");
  ctx.fillRect(x + (pose.face === "left" ? 2 : 13), y + 4, 1, 1);
  if (!pose.isMining) return;
  const isUp = Math.sin(time * 22) > 0;
  const hx = pose.face === "left" ? x - 2 : x + 16;
  ctx.fillStyle = sprites.tone("steel");
  ctx.fillRect(hx, y + (isUp ? 5 : 7), 2, 1);
  ctx.fillStyle = sprites.tone("steel-hi");
  ctx.fillRect(hx + (pose.face === "left" ? -1 : 2), y + (isUp ? 4 : 8), 1, 2);
}

export function drawCart(view: View, sprites: Sprites, x: number, y: number, fill: number): void {
  const { ctx } = view;
  ctx.drawImage(sprites.cart, x, y + 2);
  ctx.fillStyle = sprites.tone("steel-edge");
  ctx.fillRect(x + 2, y + 7, 3, 2);
  ctx.fillRect(x + 9, y + 7, 3, 2);
  ctx.fillStyle = sprites.tone("tread-hi");
  ctx.fillRect(x + 3, y + 7, 1, 1);
  ctx.fillRect(x + 10, y + 7, 1, 1);
  const tones = [sprites.tone("ore-hi"), sprites.tone("ore"), sprites.tone("ore-lo")];
  const n = Math.round(Math.min(3, fill) * 4);
  for (let i = 0; i < n; i += 1) {
    const [px = 0, py = 0] = PILE[i] ?? [];
    ctx.fillStyle = tones[i % 3] ?? "";
    ctx.fillRect(x + px, y + py + 1, 1, 1);
  }
}

export function drawStars(view: View, world: World, sprites: Sprites, time: number): void {
  const { ctx } = view;
  for (const s of world.stars) {
    if (!view.isVisible(s.y, 1) || world.maskAt(s.x, s.y) !== SKY) continue;
    const tw = Math.sin(time * (1 + s.bright) + s.phase);
    if (tw < -0.6) continue;
    ctx.fillStyle = sprites.tone(
      tw > 0.8 && s.bright > 0.7 ? "glint" : s.bright > 0.5 ? "star" : "star-dim",
    );
    ctx.fillRect(s.x, s.y - view.camY, 1, 1);
  }
}

export function drawVeinGlints(view: View, world: World, sprites: Sprites, time: number): void {
  const { ctx } = view;
  for (const v of world.veins) {
    const first = v.cells[0];
    if (v.isMined || !first || !view.isVisible(v.cy, 4)) continue;
    const p = ((time + v.phase) % 3.4) / 3.4;
    if (p > 0.14) continue;
    const [gx, gy] = first;
    const y = gy - view.camY;
    const size = p < 0.04 || p > 0.1 ? 1 : 2;
    ctx.fillStyle = sprites.tone("ore-hi");
    for (let d = 1; d <= size; d += 1) {
      ctx.fillRect(gx - d, y - 1, 1, 1);
      ctx.fillRect(gx + d, y - 1, 1, 1);
      ctx.fillRect(gx, y - 1 - d, 1, 1);
      ctx.fillRect(gx, y - 1 + d, 1, 1);
    }
    ctx.fillStyle = sprites.tone("glint");
    ctx.fillRect(gx, y - 1, 1, 1);
  }
}

const CRYSTAL_GLINT: Record<CrystalKind, string> = {
  gem: "crystal-hi",
  amethyst: "amethyst-hi",
  emerald: "emerald-hi",
};

const CRYSTAL_LIGHT: Record<CrystalKind, readonly [number, number, number]> = {
  gem: [0.45, 0.9, 1],
  amethyst: [0.78, 0.45, 1],
  emerald: [0.35, 1, 0.6],
};

function drawLava(view: View, world: World, sprites: Sprites, time: number): void {
  const { ctx } = view;
  const beat = Math.floor(time * 4);
  for (const p of world.lavas) {
    if (!view.isVisible(p.y, 2)) continue;
    const pop = (p.x * 7 + beat * 13) % 23;
    if (pop === 0) {
      ctx.fillStyle = sprites.tone("lava-top");
      ctx.fillRect(p.x, p.y - 1 - view.camY, 1, 1);
    } else if (pop === 1) {
      ctx.fillStyle = sprites.tone("lava");
      ctx.fillRect(p.x, p.y - 2 - view.camY, 1, 1);
    }
  }
}

export function drawGlows(view: View, world: World, sprites: Sprites, time: number): void {
  const { ctx } = view;
  for (const c of world.crystals) {
    if (!view.isVisible(c.y, 4) || 0.5 + 0.5 * Math.sin(time * 1.3 + c.phase) < 0.75) continue;
    ctx.fillStyle = sprites.tone(CRYSTAL_GLINT[c.kind]);
    ctx.fillRect(c.x, c.y - view.camY, 1, 1);
  }
  for (const g of world.glows) {
    if ((g.kind !== "worm" && g.kind !== "moss") || !view.isVisible(g.y, 2)) continue;
    const tw = Math.sin(time * 1.6 + g.phase * 3);
    if (tw < 0.1) continue;
    const isMoss = g.kind === "moss";
    ctx.fillStyle = sprites.tone(isMoss ? "moss-hi" : tw > 0.8 ? "worm-hi" : "worm");
    ctx.fillRect(g.x, g.y - view.camY - (isMoss ? 1 : 0), 1, 1);
  }
  drawLava(view, world, sprites, time);
  const shift = Math.floor(time * 5);
  for (const p of world.puddles) {
    if (!view.isVisible(p.y, 1)) continue;
    const l = view.lightAt(p.x, p.y - 1);
    const wave = (p.x + shift) % 9;
    if (wave !== 0 && !(wave === 4 && l > 0.3)) continue;
    ctx.fillStyle = sprites.tone(l > 0.45 ? "spray" : "spray-lo");
    ctx.fillRect(p.x, p.y - view.camY, 1, 1);
  }
}

export function glowLights(world: World, time: number): Light[] {
  const crystals = world.crystals.map(
    (c): Light => ({
      x: c.x,
      y: c.y,
      radius: c.kind === "amethyst" ? 34 : 30,
      intensity: 0.32 + 0.22 * (0.5 + 0.5 * Math.sin(time * 1.3 + c.phase)),
      color: CRYSTAL_LIGHT[c.kind],
      falloff: 1.6,
    }),
  );
  const molten = world.glows
    .filter((g) => g.kind === "lava" || g.kind === "moss")
    .map(
      (g): Light =>
        g.kind === "lava"
          ? {
              x: g.x,
              y: g.y,
              radius: 34,
              intensity: 0.55 + 0.1 * Math.sin(time * 2.1 + g.phase),
              color: [1, 0.48, 0.18],
              falloff: 1.5,
              hasShadow: false,
            }
          : {
              x: g.x,
              y: g.y,
              radius: 20,
              intensity: 0.3 + 0.1 * Math.sin(time * 1.4 + g.phase),
              color: [0.4, 1, 0.55],
              falloff: 1.7,
            },
    );
  const mushrooms = world.glows
    .filter((g) => g.kind === "mushroom")
    .map(
      (g): Light => ({
        x: g.x,
        y: g.y + 1,
        radius: 22,
        intensity: 0.34 + 0.12 * Math.sin(time * 1.7 + g.phase),
        color: [0.35, 0.95, 0.85],
        falloff: 1.7,
      }),
    );
  return [...crystals, ...mushrooms, ...molten];
}
