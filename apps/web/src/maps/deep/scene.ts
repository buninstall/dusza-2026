import type { Light } from "../../auth/lamp/lighting.ts";
import { type Dig, type Level, type Mine, SHAFT_W } from "./build.ts";
import { createBats, createDrips, createMotes, createSparks } from "./critters.ts";
import { createRobot, standY } from "./robot.ts";
import {
  createSprites,
  drawCart,
  drawGlows,
  drawRobot,
  drawStars,
  drawVeinGlints,
  glowLights,
  type Sprites,
} from "./sprites.ts";
import { mineVein } from "./terrain.ts";
import type { View } from "./view.ts";
import { seeded, type Vein } from "./world.ts";

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const STATIC_WARMUP = 600;
const WARM = [1, 0.88, 0.64] as const;
const HALO = [1, 0.86, 0.66] as const;
const CAGE = [1, 0.8, 0.55] as const;
const LANTERN = [1, 0.68, 0.36] as const;
const GOLD = [1, 0.84, 0.42] as const;
const DRILL = [1, 0.55, 0.25] as const;
const BEACON = [1, 0.25, 0.15] as const;
const SHAFT_DIG_SPEED = 38;
const GALLERY_DIG_SPEED = 110;
const FLIGHT_TIME = 0.9;

type Flight = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  cart: { fill: number };
  hasLanded: boolean;
};
type DigRun = Dig & { phase: 1 | 2 | 3; t: number; shaftY: number; digX: number };

export type SceneOptions = {
  mine: Mine;
  view: View;
  isNarrow: boolean;
  isStatic: boolean;
  isFresh: boolean;
  roofY: number;
  target: () => number | null;
  onDigDone: (level: Level) => void;
};

export function runScene(options: SceneOptions): () => void {
  const { mine, view, isNarrow } = options;
  const { world, shaftX, bottomY, levels, front } = mine;
  const sprites: Sprites = createSprites(world);
  const fx = seeded(17);
  const bats = createBats(world, seeded(3), options.roofY);
  const drips = createDrips(world, seeded(4));
  const motes = createMotes(world, view.W, view.H, seeded(5));
  const sparks = createSparks(world);
  const flights: Flight[] = [];
  const smoke: { x: number; y: number; t: number; vx: number }[] = [];
  let dig: DigRun | null = mine.dig
    ? { ...mine.dig, phase: 1, t: 0, shaftY: mine.dig.shaftTop, digX: mine.dig.level.x0 }
    : null;
  let time = 0;
  let wheelAngle = 0;
  let frameNo = 0;
  let lastLights: Light[] = [];

  const onHit = (v: Vein, level: Level) => {
    mineVein(world, v);
    view.refresh({ x: v.cx - 6, y: v.cy - 6, w: 13, h: 13 });
    sparks.emit(v.cx - 1, v.cy, 14, fx, { angle: Math.PI, spread: 2.2, speed: 45 });
    sparks.emit(v.cx - 1, v.cy, 6, fx, {
      angle: Math.PI,
      spread: 1.6,
      speed: 25,
      isHot: false,
      life: 1,
    });
    if (level.cart) {
      flights.push({
        x0: v.cx - 2,
        y0: v.cy,
        x1: level.cart.x + 7,
        y1: level.cart.y + 1,
        t: 0,
        cart: level.cart,
        hasLanded: false,
      });
    }
  };
  const {
    robot,
    update: updateRobot,
    setWanted,
  } = createRobot({
    shaftX,
    surfaceY: options.isFresh || !levels[0] ? mine.groundY - 16 : standY(levels[0]),
    driveSpeed: isNarrow ? 36 : 46,
    levels,
    onHit,
  });

  const reveal = (x0: number, y0: number, x1: number, y1: number) => {
    if (!dig) return;
    dig.reveal(x0, y0, x1, y1);
    view.refresh({
      x: Math.floor(x0),
      y: Math.floor(y0),
      w: Math.ceil(x1 - x0) + 1,
      h: Math.ceil(y1 - y0) + 1,
    });
  };

  const stepDig = (dt: number) => {
    if (!dig) return;
    dig.t += dt;
    const { level } = dig;
    if (dig.phase === 1) {
      const end = level.y1 + 1;
      const y = Math.min(end, dig.shaftTop + dig.t * SHAFT_DIG_SPEED);
      reveal(shaftX - 3, dig.shaftY, shaftX + SHAFT_W + 3, y + 1);
      dig.shaftY = y;
      if (Math.floor(time * 30) % 2 === 0)
        sparks.emit(shaftX + 8, y, 3, fx, { spread: 2.8, speed: 30, isHot: fx() < 0.6 });
      if (y >= end) {
        dig.phase = 2;
        dig.t = 0;
      }
    } else if (dig.phase === 2) {
      const x = Math.min(level.x1 + 3, level.x0 + dig.t * GALLERY_DIG_SPEED);
      reveal(dig.digX, level.y0 - 22, x + 1, level.y1 + 3);
      dig.digX = x;
      if (Math.floor(time * 30) % 2 === 0) {
        sparks.emit(x, level.rail - 6 - fx() * 6, 3, fx, { angle: 0, spread: 2.4, speed: 34 });
        sparks.emit(x - 2, level.rail - 2, 2, fx, {
          angle: Math.PI,
          spread: 1.2,
          speed: 18,
          isHot: false,
          life: 1.1,
        });
      }
      if (x >= level.x1 + 3) {
        reveal(shaftX - 3, dig.shaftTop, world.W, level.y1 + 3);
        dig.phase = 3;
        dig.t = 0;
        level.isDigging = false;
        view.bake(staticLights());
        options.onDigDone(level);
      }
    } else if (dig.t > 1.2) {
      dig = null;
    }
  };

  const stepEffects = (dt: number) => {
    wheelAngle += (robot.cageSpeed * dt) / 7;
    bats.update(dt, view, robot.x);
    drips.update(dt);
    motes.update(dt, time);
    sparks.update(dt);
    for (const f of flights) {
      f.t += dt / FLIGHT_TIME;
      if (f.t >= 1 && !f.hasLanded) {
        f.hasLanded = true;
        f.cart.fill = Math.min(3, f.cart.fill + 1);
        sparks.emit(f.x1, f.y1, 6, fx, { speed: 22, life: 0.4 });
      }
    }
    for (let i = flights.length - 1; i >= 0; i -= 1)
      if ((flights[i]?.t ?? 1) >= 1) flights.splice(i, 1);
    if (mine.house && fx() < dt * 3)
      smoke.push({ x: mine.house.x + 6, y: mine.house.y - 14, t: 0, vx: 1 + fx() * 2 });
    for (const s of smoke) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y -= 5 * dt;
    }
    while ((smoke[0]?.t ?? 0) > 4) smoke.shift();
  };

  const sim = (dt: number) => {
    time += dt;
    const index = options.target();
    setWanted(index === null ? null : (levels.find((l) => l.index === index) ?? null));
    stepDig(dt);
    updateRobot(dt);
    stepEffects(dt);
  };

  const drillPos = () => {
    if (dig?.phase === 1) return { x: shaftX + 8, y: dig.shaftY };
    if (dig?.phase === 2) return { x: dig.digX, y: dig.level.rail - 6 };
    return { x: shaftX + 8, y: bottomY - 2 };
  };

  const staticLights = (): Light[] => {
    const list: Light[] = [];
    for (const level of [...levels, front]) {
      if (level.isDigging || level.state === "off") continue;
      list.push({
        x: level.box.x + level.box.w / 2,
        y: level.box.y - 8,
        radius: level.box.w * 0.62,
        intensity: level.state === "on" ? 0.3 : 0.16,
        color: LANTERN,
        falloff: 2.2,
        hasShadow: false,
      });
    }
    for (const l of mine.lanterns) {
      if (l.level.isDigging || l.state === "off") continue;
      const isOn = l.state === "on";
      list.push({
        x: l.x + 2,
        y: l.y + 3,
        radius: (l.isSmall ? 40 : 56) * (isOn ? 1 : 0.7),
        intensity: isOn ? 0.85 : 0.45,
        color: LANTERN,
        falloff: 1.7,
      });
    }
    list.push(...glowLights(world, 0));
    list.push({
      x: mine.signLamp.x + 2,
      y: mine.signLamp.y + 4,
      radius: 90,
      intensity: 0.55,
      color: LANTERN,
      falloff: 1.6,
      hasShadow: false,
    });
    if (mine.house) {
      list.push({
        x: mine.house.x + 12,
        y: mine.house.y + 6,
        radius: 30,
        intensity: 0.6,
        color: CAGE,
        falloff: 1.7,
        hasShadow: false,
      });
    }
    return list;
  };

  const lights = (): Light[] => {
    const dir = robot.face === "left" ? -1 : 1;
    const list: Light[] = [
      {
        x: robot.x + 8 + dir * 6,
        y: robot.y + 5,
        radius: isNarrow ? 90 : 120,
        intensity: 1.2,
        color: WARM,
        falloff: 1.2,
        cone: {
          dx: Math.cos(robot.sweep) * dir,
          dy: Math.sin(robot.sweep) + 0.03,
          half: 0.34,
          soft: 0.24,
        },
      },
      { x: robot.x + 8, y: robot.y + 7, radius: 26, intensity: 0.55, color: HALO, falloff: 1.8 },
    ];
    if (!robot.isInCage) {
      list.push({
        x: shaftX + 8,
        y: robot.cageY - 4,
        radius: 24,
        intensity: 0.45,
        color: CAGE,
        falloff: 1.8,
      });
    }
    const drill = drillPos();
    if (view.isVisible(drill.y, 40)) {
      list.push({
        ...drill,
        radius: dig ? 70 : 44,
        intensity: (dig ? 1 : 0.6) * (0.8 + 0.2 * Math.sin(time * 23)),
        color: DRILL,
        falloff: 1.5,
        hasShadow: false,
      });
    }
    if (Math.floor(time * 1.2) % 2 === 0 && view.isVisible(mine.beacon.y, 24)) {
      list.push({
        ...mine.beacon,
        radius: 18,
        intensity: 0.8,
        color: BEACON,
        falloff: 1.6,
        hasShadow: false,
      });
    }
    if (robot.mining && robot.miningPhase > 0.35 && robot.miningPhase < 0.7) {
      list.push({
        x: robot.mining.cx - 2,
        y: robot.mining.cy,
        radius: 30,
        intensity: 0.8,
        color: GOLD,
        falloff: 1.3,
        hasShadow: false,
      });
    }
    for (const f of flights) {
      const x = f.x0 + (f.x1 - f.x0) * f.t;
      const y = f.y0 + (f.y1 - f.y0) * f.t - Math.sin(f.t * Math.PI) * 16;
      list.push({ x, y, radius: 12, intensity: 0.7, color: GOLD, falloff: 1.4, hasShadow: false });
    }
    return list;
  };

  const drawDrill = () => {
    const { ctx } = view;
    const { x, y } = drillPos();
    const cy = Math.round(y) - view.camY;
    const spin = Math.floor(time * 24) % 2;
    ctx.fillStyle = sprites.tone("truss");
    if (dig?.phase === 2) {
      const dx = Math.round(x);
      ctx.fillRect(dx - 16, cy - 5, 12, 10);
      ctx.fillStyle = sprites.tone("alert");
      for (let k = 0; k < 12; k += 2) ctx.fillRect(dx - 16 + k, cy - 5, 1, 2);
      for (let k = 0; k < 6; k += 1) {
        ctx.fillStyle = sprites.tone((k + spin) % 2 ? "steel" : "tread-hi");
        ctx.fillRect(dx - 4 + k, cy - 4 + Math.floor(k / 2), 1, 9 - Math.floor(k / 2) * 2);
      }
      return;
    }
    const dx = Math.round(x) - 7;
    ctx.fillRect(dx, cy - 14, 14, 8);
    ctx.fillStyle = sprites.tone("alert");
    for (let k = 0; k < 14; k += 2) ctx.fillRect(dx + k, cy - 14, 1, 2);
    for (let k = 0; k < 6; k += 1) {
      ctx.fillStyle = sprites.tone((k + spin) % 2 ? "steel" : "tread-hi");
      ctx.fillRect(dx + 1 + Math.floor(k / 2), cy - 6 + k, 12 - Math.floor(k / 2) * 2, 1);
    }
  };

  const drawCage = () => {
    const { ctx } = view;
    const top = Math.round(robot.cageY) - 6 - view.camY;
    const wy = mine.wheel.y + 7 - view.camY;
    ctx.fillStyle = sprites.tone("cable");
    if (top > wy) ctx.fillRect(shaftX + 7, Math.max(0, wy), 1, top - Math.max(0, wy));
    ctx.fillStyle = sprites.tone("steel-edge");
    ctx.fillRect(shaftX - 1, top, 18, 2);
    ctx.fillRect(shaftX - 1, top + 20, 18, 2);
    ctx.fillStyle = sprites.tone("steel-lo");
    ctx.fillRect(shaftX - 1, top, 18, 1);
    ctx.fillRect(shaftX - 1, top + 20, 18, 1);
    ctx.fillStyle = sprites.tone("truss-lo");
    for (let bx = shaftX - 1; bx < shaftX + 17; bx += 3) ctx.fillRect(bx, top + 2, 1, 18);
    ctx.fillStyle = sprites.tone("visor");
    ctx.fillRect(shaftX + 7, top + 2, 2, 1);
  };

  const drawWheel = () => {
    const { ctx } = view;
    const { x, y } = mine.wheel;
    if (!view.isVisible(y, 10)) return;
    const wy = y - view.camY;
    ctx.fillStyle = sprites.tone("steel-lo");
    for (let a = 0; a < 4; a += 1) {
      const th = wheelAngle + (a * Math.PI) / 4;
      for (let r = -6; r <= 6; r += 1)
        ctx.fillRect(Math.round(x + Math.cos(th) * r), Math.round(wy + Math.sin(th) * r), 1, 1);
    }
    ctx.fillStyle = sprites.tone("truss");
    for (let a = 0; a < 40; a += 1) {
      const th = (a / 40) * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(th) * 7), Math.round(wy + Math.sin(th) * 7), 1, 1);
    }
    ctx.fillStyle = sprites.tone(Math.floor(time * 1.2) % 2 === 0 ? "beacon" : "beacon-off");
    ctx.fillRect(mine.beacon.x - 1, mine.beacon.y - view.camY, 2, 2);
  };

  const drawScenery = () => {
    const { ctx } = view;
    drawStars(view, world, sprites, time);
    ctx.fillStyle = sprites.tone("smoke");
    for (const s of smoke) {
      ctx.globalAlpha = Math.max(0, 0.5 - s.t * 0.12);
      const size = s.t > 1.5 ? 2 : 1;
      ctx.fillRect(
        Math.round(s.x + Math.sin(s.t * 2) * 1.5),
        Math.round(s.y) - view.camY,
        size,
        size,
      );
    }
    ctx.globalAlpha = 1;
    for (const l of mine.lanterns) {
      if (!view.isVisible(l.y, 8) || l.level.isDigging) continue;
      ctx.fillStyle = sprites.tone("steel-edge");
      ctx.fillRect(l.x + 2, l.y - 2 - view.camY, 1, 2);
      ctx.drawImage(sprites.lantern[l.state], l.x, l.y - view.camY);
    }
    if (view.isVisible(mine.signLamp.y, 8)) {
      ctx.drawImage(sprites.lantern.on, mine.signLamp.x, mine.signLamp.y - view.camY);
    }
    drawGlows(view, world, sprites, time);
    drawVeinGlints(view, world, sprites, time);
    for (const level of levels) {
      if (level.cart && !level.isDigging && view.isVisible(level.cart.y, 12)) {
        drawCart(view, sprites, level.cart.x, level.cart.y - view.camY, level.cart.fill);
      }
    }
  };

  const render = () => {
    frameNo += 1;
    const canRelight = (frameNo & 1) === 0;
    if (canRelight || lastLights.length === 0) lastLights = lights();
    view.render(lastLights, canRelight);
    const { ctx } = view;
    drawScenery();
    drawRobot(
      view,
      sprites,
      {
        x: robot.x,
        y: robot.y,
        face: robot.face,
        travel: robot.travel,
        isMining: robot.mining !== null,
      },
      time,
    );
    drawCage();
    drawWheel();
    drawDrill();
    if (view.front) bats.draw(view, view.front);
    drips.draw(view);
    motes.draw(view);
    sparks.draw(view);
    for (const f of flights) {
      const x = Math.round(f.x0 + (f.x1 - f.x0) * f.t);
      const y = Math.round(f.y0 + (f.y1 - f.y0) * f.t - Math.sin(f.t * Math.PI) * 16) - view.camY;
      ctx.fillStyle = sprites.tone("ore");
      ctx.fillRect(x - 1, y - 1, 3, 2);
      ctx.fillStyle = sprites.tone("ore-hi");
      ctx.fillRect(x - 1, y - 1, 1, 1);
    }
  };

  if (options.isStatic && dig) {
    dig.reveal(0, 0, world.W, world.H);
    dig.level.isDigging = false;
    options.onDigDone(dig.level);
    dig = null;
  }
  view.bake(staticLights());

  if (options.isStatic) {
    for (let i = 0; i < STATIC_WARMUP; i += 1) sim(STEP);
    let pending = 0;
    const draw = () => {
      pending = 0;
      render();
    };
    const onScroll = () => {
      if (!pending) pending = requestAnimationFrame(draw);
    };
    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(pending);
    };
  }

  let handle = 0;
  let last = performance.now();
  let acc = 0;
  const loop = (now: number) => {
    acc += Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      sim(STEP);
      acc -= STEP;
    }
    render();
    handle = requestAnimationFrame(loop);
  };
  handle = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(handle);
}
