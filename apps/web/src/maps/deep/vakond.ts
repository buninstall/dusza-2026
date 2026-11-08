import { spriteCanvas } from "../../auth/lamp/canvas-art.ts";
import type { Light } from "../../auth/lamp/lighting.ts";
import type { Level } from "./build.ts";
import type { Sparks } from "./critters.ts";
import type { Sprites } from "./sprites.ts";
import type { View } from "./view.ts";
import type { World } from "./world.ts";

const BODY = [
  "....kkkkk.....",
  "...kHHHHVk....",
  "..kHVVVVVVk...",
  "..kVeVVVVVk...",
  "..kVVVVVVVk...",
  ".kkkkkkkkkkk..",
  ".kVHVHVHVHVk..",
  ".kVVVVVVVVVk..",
  ".kkkkkkkkkkk..",
  "ktttttttttttk.",
  ".kkkkkkkkkkk..",
];

const KNOCK_PERIOD = 1.05;
const SWING_START = 0.72;
const SWING_HIT = 0.82;
const EYE = [1, 0.32, 0.18] as const;
const SPARK = [1, 0.78, 0.45] as const;

export type Vakond = {
  update: (time: number, fx: () => number) => void;
  draw: (view: View, sprites: Sprites, time: number) => void;
  lights: (time: number) => Light[];
};

export function createVakond(
  world: World,
  front: Level,
  sparks: Sparks,
  isSilent: boolean,
): Vakond {
  const tones = { k: "vakond-lo", V: "vakond", H: "vakond-hi", t: "tread", e: "vakond-lo" };
  const body = spriteCanvas(BODY, tones, world.palette);
  const face = front.x1 - 1;
  const x = face - 22;
  const y = front.rail - BODY.length;
  let lastKnock = -1;
  const swing = (time: number) => {
    if (isSilent) return 0;
    const p = (time % KNOCK_PERIOD) / KNOCK_PERIOD;
    if (p < SWING_START) return Math.min(1, p / 0.2);
    return p < SWING_HIT ? 1 - (p - SWING_START) / (SWING_HIT - SWING_START) : 0;
  };
  const update = (time: number, fx: () => number) => {
    if (isSilent) return;
    const beat = Math.floor(time / KNOCK_PERIOD);
    const p = (time % KNOCK_PERIOD) / KNOCK_PERIOD;
    if (p >= SWING_HIT && beat !== lastKnock) {
      lastKnock = beat;
      sparks.emit(face - 1, y + 4, 9, fx, { angle: Math.PI, spread: 2, speed: 40, life: 0.5 });
      sparks.emit(face - 1, y + 6, 4, fx, {
        angle: Math.PI,
        spread: 1.4,
        speed: 16,
        isHot: false,
        life: 0.9,
      });
    }
  };
  const draw = (view: View, sprites: Sprites, time: number) => {
    if (!view.isVisible(y, 16)) return;
    const { ctx } = view;
    const top = y - view.camY;
    ctx.drawImage(body, x, top);
    ctx.fillStyle = sprites.tone(isSilent ? "lantern-off" : "beacon");
    ctx.fillRect(x + 4, top + 3, 1, 1);
    const lift = swing(time);
    const shoulderX = x + 11;
    const shoulderY = top + 6;
    const tipX = shoulderX + 5 + Math.round((1 - lift) * 4);
    const tipY = shoulderY - Math.round(lift * 6);
    ctx.fillStyle = sprites.tone("wood");
    const steps = Math.max(Math.abs(tipX - shoulderX), Math.abs(tipY - shoulderY));
    for (let i = 0; i <= steps; i += 1) {
      const t = steps === 0 ? 0 : i / steps;
      ctx.fillRect(
        Math.round(shoulderX + (tipX - shoulderX) * t),
        Math.round(shoulderY + (tipY - shoulderY) * t),
        1,
        1,
      );
    }
    ctx.fillStyle = sprites.tone("steel-hi");
    ctx.fillRect(tipX, tipY - 2, 1, 5);
    ctx.fillRect(tipX + 1, tipY, 1, 1);
  };
  const lights = (time: number): Light[] => {
    if (isSilent) return [];
    const list: Light[] = [
      {
        x: x + 4,
        y: y + 3,
        radius: 14,
        intensity: 0.55,
        color: EYE,
        falloff: 1.7,
        hasShadow: false,
      },
    ];
    const p = (time % KNOCK_PERIOD) / KNOCK_PERIOD;
    if (p >= SWING_HIT && p < SWING_HIT + 0.08) {
      list.push({
        x: face - 2,
        y: y + 4,
        radius: 26,
        intensity: 0.9,
        color: SPARK,
        falloff: 1.4,
        hasShadow: false,
      });
    }
    return list;
  };
  return { update, draw, lights };
}
