import { spriteCanvas } from "../../auth/lamp/canvas-art.ts";
import type { View } from "./view.ts";
import { toneHex, type World } from "./world.ts";

const BAT_UP = ["k.......k", "kk.....kk", ".kkkekkk.", "...kkk...", "....k...."];
const BAT_DOWN = [".........", "...kek...", ".kkkkkkk.", "kk.kkk.kk", "k...k...k"];
const BAT_HANG = [".k.", "kkk", "kkk", "kek", ".k."];

type BatSet = { up: HTMLCanvasElement; down: HTMLCanvasElement; hang: HTMLCanvasElement };

type Bat = {
  rx: number;
  ry: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHanging: boolean;
  isHoming: boolean;
  t: number;
  tx: number;
  ty: number;
  flap: number;
  retarget: number;
  startle: number;
  home: number;
  jumpy: number;
  fuse: number;
  fleeX: number;
};

function batSet(world: World, body: string, eye: string): BatSet {
  const tones = { k: body, e: eye };
  return {
    up: spriteCanvas(BAT_UP, tones, world.palette),
    down: spriteCanvas(BAT_DOWN, tones, world.palette),
    hang: spriteCanvas(BAT_HANG, tones, world.palette),
  };
}

export type Bats = {
  update: (dt: number, view: View, threatX: number) => void;
  draw: (view: View, ctx: CanvasRenderingContext2D) => void;
  scare: (x: number, y: number) => void;
};

const MAX_CAVE_BATS = 8;
const ROOF_GAP = 70;
const SCARE_REACH = 6;
const SCARE_SPREAD = 26;
const SCARE_KICK = 1.7;

export function createBats(world: World, rand: () => number, roofY: number): Bats {
  const lit = batSet(world, "rubble-hi", "bat-eye");
  const dim = batSet(world, "bat-lit", "bat-eye");
  const dark = batSet(world, "lantern-off-hi", "bat-eye");
  const step = Math.max(1, Math.ceil(world.roosts.length / MAX_CAVE_BATS));
  const caves = world.roosts.filter((_, i) => i % step === 0).map((r) => ({ ...r, isRoof: false }));
  const roof = Array.from({ length: Math.max(2, Math.floor(world.W / ROOF_GAP)) }, (_, i) => ({
    x: Math.round((i + 0.3 + rand() * 0.4) * ROOF_GAP),
    y: roofY,
    isRoof: true,
  })).filter((r) => r.x < world.W - 4);
  const bats: (Bat & { isRoof: boolean })[] = [...roof, ...caves].map((r) => ({
    rx: r.x,
    ry: r.y,
    x: r.x,
    y: r.y,
    vx: 0,
    vy: 0,
    isHanging: true,
    isHoming: false,
    t: 0,
    tx: r.x,
    ty: r.y,
    flap: rand() * 4,
    retarget: 0,
    startle: -rand() * 6,
    home: 0,
    jumpy: 0.12 + rand() * 0.4,
    fuse: 0,
    fleeX: r.x,
    isRoof: r.isRoof,
  }));
  const takeOff = (b: Bat, fromX: number, kick = 1) => {
    b.isHanging = false;
    b.isHoming = false;
    b.fuse = 0;
    b.t = 4 + rand() * 5;
    b.retarget = 0;
    b.home = 0;
    b.vx = (b.x < fromX ? -1 : 1) * (24 + rand() * 20) * kick;
    b.vy = (20 + rand() * 12) * kick;
  };
  const roost = (b: Bat) => {
    b.isHanging = true;
    b.isHoming = false;
    b.x = b.rx;
    b.y = b.ry;
    b.vx = 0;
    b.vy = 0;
    b.startle = -3 - rand() * 6;
  };
  const hang = (b: Bat & { isRoof: boolean }, dt: number, view: View, threatX: number) => {
    if (b.fuse > 0) {
      b.fuse -= dt;
      if (b.fuse <= 0) takeOff(b, b.fleeX, SCARE_KICK);
      return;
    }
    if (!view.isVisible(b.ry, 30)) return;
    const l = b.isRoof ? 0 : view.lightAt(b.rx, b.ry + 2);
    if (l > 0.55) b.startle += dt;
    else b.startle = b.startle < 0 ? Math.min(0, b.startle + dt) : Math.max(0, b.startle - dt);
    const restless = b.startle >= 0 && rand() < dt * (b.isRoof ? 0.05 : 0.02);
    if (b.startle > b.jumpy || restless) takeOff(b, threatX);
  };
  const fly = (b: Bat, dt: number, view: View) => {
    b.t -= dt;
    b.retarget -= dt;
    b.flap += dt * (b.isHoming ? 11 : 15);
    if (!b.isHoming) {
      if (b.retarget <= 0) {
        b.tx = 6 + rand() * (world.W - 12);
        b.ty = Math.max(roofY + 6, view.camY + 12 + rand() * Math.max(10, view.H - 24));
        b.retarget = 0.6 + rand() * 1.1;
      }
      if (b.t <= 0) b.isHoming = true;
    } else {
      b.home += dt;
    }
    const tx = b.isHoming ? b.rx : b.tx;
    const ty = b.isHoming ? b.ry : b.ty;
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy) + 0.001;
    const speed = b.isHoming ? Math.min(60, 12 + d * 1.5) : 62;
    const k = Math.min(1, dt * 2.6);
    b.vx += ((dx / d) * speed - b.vx) * k;
    b.vy += ((dy / d) * speed - b.vy) * k;
    b.x += b.vx * dt;
    b.y = Math.max(roofY, b.y + (b.vy + Math.sin(b.flap * 0.9) * 10) * dt);
    if (b.isHoming && (d < 1.6 || b.home > 9)) roost(b);
  };
  const update = (dt: number, view: View, threatX: number) => {
    for (const b of bats) {
      if (b.isHanging) hang(b, dt, view, threatX);
      else fly(b, dt, view);
    }
  };
  const draw = (view: View, ctx: CanvasRenderingContext2D) => {
    for (const b of bats) {
      if (!view.isVisible(b.y, 8)) continue;
      const l = view.lightAt(b.x, b.y + 1);
      const set = l > 0.6 ? lit : l > 0.25 ? dim : dark;
      const x = Math.round(b.x);
      const y = Math.round(b.y) - view.camY;
      if (b.isHanging) ctx.drawImage(set.hang, x - 1, y);
      else ctx.drawImage(Math.floor(b.flap) % 2 ? set.up : set.down, x - 4, y - 2);
    }
  };
  const scare = (x: number, y: number) => {
    for (const b of bats) {
      if (!b.isHanging || b.fuse > 0) continue;
      const d = Math.hypot(b.rx - x, b.ry + 2 - y);
      if (d < SCARE_REACH) takeOff(b, x, SCARE_KICK);
      else if (d < SCARE_SPREAD) {
        b.fleeX = x;
        b.fuse = 0.12 + (d / SCARE_SPREAD) * 0.3 + rand() * 0.25;
      }
    }
  };
  return { update, draw, scare };
}

type DripState = {
  x: number;
  top: number;
  floor: number;
  t: number;
  grow: number;
  splash: number;
  dropY: number | null;
  vy: number;
};

export type Drips = { update: (dt: number) => void; draw: (view: View) => void };

export function createDrips(world: World, rand: () => number): Drips {
  const spots: DripState[] = world.drips.map((d) => ({
    ...d,
    t: rand() * 4,
    grow: 0,
    splash: 0,
    dropY: null,
    vy: 0,
  }));
  const bright = toneHex(world.palette, "spray");
  const faint = toneHex(world.palette, "spray-lo");
  const update = (dt: number) => {
    for (const s of spots) {
      if (s.splash > 0) s.splash -= dt;
      if (s.dropY !== null) {
        s.vy += 160 * dt;
        s.dropY += s.vy * dt;
        if (s.dropY >= s.floor) {
          s.dropY = null;
          s.splash = 0.35;
        }
        continue;
      }
      s.t -= dt;
      if (s.t < 0.9) s.grow = 1 - s.t / 0.9;
      if (s.t <= 0) {
        s.dropY = s.top + 1;
        s.vy = 0;
        s.grow = 0;
        s.t = 2.2 + rand() * 4.5;
      }
    }
  };
  const draw = (view: View) => {
    const { ctx } = view;
    for (const s of spots) {
      if (!view.isVisible(s.top, 4) && !view.isVisible(s.floor, 4)) continue;
      const l = Math.max(view.lightAt(s.x, s.top + 2), view.lightAt(s.x, s.floor - 2));
      ctx.globalAlpha = Math.min(1, 0.18 + l * 1.4);
      ctx.fillStyle = l > 0.4 ? bright : faint;
      if (s.grow > 0.3) ctx.fillRect(s.x, s.top + 1 - view.camY, 1, 1);
      if (s.dropY !== null)
        ctx.fillRect(s.x, Math.round(s.dropY) - view.camY, 1, s.vy > 60 ? 2 : 1);
      if (s.splash > 0) {
        const r = s.splash > 0.2 ? 1 : 2;
        const y = s.floor - 1 - view.camY - (r === 1 ? 1 : 0);
        ctx.fillRect(s.x - r, y, 1, 1);
        ctx.fillRect(s.x + r, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  };
  return { update, draw };
}

export type Motes = { update: (dt: number, time: number) => void; draw: (view: View) => void };

export function createMotes(world: World, W: number, H: number, rand: () => number): Motes {
  const motes = Array.from({ length: Math.round((W * H) / 1100) }, () => ({
    x: rand() * W,
    y: rand() * H,
    vx: (rand() - 0.5) * 3,
    vy: -0.6 - rand() * 2.2,
    seed: rand() * 9,
  }));
  const hot = toneHex(world.palette, "lamp");
  const warm = toneHex(world.palette, "beam");
  const update = (dt: number, time: number) => {
    for (const m of motes) {
      m.x += (m.vx + Math.sin(time * 0.7 + m.seed) * 1.2) * dt;
      m.y += m.vy * dt;
      if (m.y < -2) m.y = H + 2;
      if (m.x < -2) m.x = W + 2;
      if (m.x > W + 2) m.x = -2;
    }
  };
  const draw = (view: View) => {
    const { ctx } = view;
    for (const m of motes) {
      const l = view.lightAt(m.x, m.y + view.camY);
      if (l <= 0.45) continue;
      ctx.globalAlpha = Math.min(1, (l - 0.42) * 1.4);
      ctx.fillStyle = l > 0.85 ? hot : warm;
      ctx.fillRect(Math.floor(m.x), Math.floor(m.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  };
  return { update, draw };
}

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isHot: boolean;
  g: number;
};

export type SparkOptions = {
  angle?: number;
  spread?: number;
  speed?: number;
  life?: number;
  isHot?: boolean;
  gravity?: number;
};

export type Sparks = {
  emit: (x: number, y: number, n: number, rand: () => number, options?: SparkOptions) => void;
  update: (dt: number) => void;
  draw: (view: View) => void;
};

export function createSparks(world: World): Sparks {
  let list: Spark[] = [];
  const tones = ["glint", "ore-hi", "ore", "rubble-hi", "rubble"].map((t) =>
    toneHex(world.palette, t),
  );
  const emit = (
    x: number,
    y: number,
    n: number,
    rand: () => number,
    options: SparkOptions = {},
  ) => {
    for (let k = 0; k < n; k += 1) {
      const a = (options.angle ?? -Math.PI / 2) + (rand() - 0.5) * (options.spread ?? 2.6);
      const s = (options.speed ?? 40) * (0.4 + rand() * 0.8);
      list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: (options.life ?? 0.7) * (0.6 + rand() * 0.6),
        isHot: options.isHot ?? true,
        g: options.gravity ?? 110,
      });
    }
  };
  const update = (dt: number) => {
    for (const p of list) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    list = list.filter((p) => p.life > 0);
  };
  const draw = (view: View) => {
    for (const p of list) {
      if (!view.isVisible(p.y, 2)) continue;
      const tone = p.isHot
        ? p.life > 0.45
          ? tones[0]
          : p.life > 0.22
            ? tones[1]
            : tones[2]
        : p.life > 0.3
          ? tones[3]
          : tones[4];
      view.ctx.fillStyle = tone ?? "";
      view.ctx.fillRect(Math.round(p.x), Math.round(p.y) - view.camY, 1, 1);
    }
  };
  return { emit, update, draw };
}
