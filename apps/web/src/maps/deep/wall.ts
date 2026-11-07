import type { Light } from "../../auth/lamp/lighting.ts";
import { viewportWidth } from "../../lib/scrollbar-gap.ts";
import { createDrips } from "./critters.ts";
import { readDeepPalette } from "./palette.ts";
import { createSprites, drawGlows, drawVeinGlints, glowLights, type Sprites } from "./sprites.ts";
import { cave, edges, paintRock, vein } from "./terrain.ts";
import { createView, type View } from "./view.ts";
import { createWorld, pageHeight, seeded, toneHex, type World } from "./world.ts";

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const LANTERN = [1, 0.68, 0.36] as const;
const LANTERN_GAP = 150;
const CAVE_GAP = 110;
const FIREFLY_AREA = 14000;
const WALL_AMBIENT = [0.2, 0.12, 1, 0.24, 0.18, 0.22, 0.24];

const WEB_ART = [
  "w.....w.....",
  ".w....w....w",
  "..w...w...w.",
  "wwwwwwwwwww.",
  "...w..w..w..",
  "....w.w.w...",
  ".....www....",
  "wwwwwwwwww..",
  "......w.....",
  "......w.....",
];

const SPIDER_ART = [".k.k.", "kkkkk", ".kek.", "k.k.k"];

export type WallHost = {
  canvas: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  front: HTMLCanvasElement | null;
  paletteSource: Element;
  roofY: number;
  safe: { x0: number; x1: number };
  isCalm: boolean;
  isStatic: boolean;
};

type Firefly = { x: number; y: number; phase: number; speed: number; drift: number };
type Spider = { x: number; top: number; phase: number; span: number };
type WallLamp = { x: number; y: number };

function webs(world: World, roof: number): Spider[] {
  const spiders: Spider[] = [];
  for (const isLeft of [true, false]) {
    const x = isLeft ? 1 : world.W - (WEB_ART[0] ?? "").length - 1;
    const art = isLeft ? WEB_ART : WEB_ART.map((row) => [...row].reverse().join(""));
    world.rows(art, { w: "star-dim" }, x, roof);
    spiders.push({ x: isLeft ? x + 6 : x + 5, top: roof + 9, phase: isLeft ? 0 : 2.4, span: 10 });
  }
  return spiders;
}

const MIN_MARGIN = 16;

function buildWall(
  W: number,
  H: number,
  roof: number,
  safe: { x0: number; x1: number },
  palette: Readonly<Record<string, string>>,
) {
  const world = createWorld(W, H, palette);
  const rand = seeded(29);
  paintRock(world, roof, rand);
  const lamps: WallLamp[] = [];
  const margins = [
    { x0: 2, x1: safe.x0 - 3 },
    { x0: safe.x1 + 3, x1: W - 2 },
  ].filter((m) => m.x1 - m.x0 >= MIN_MARGIN);
  margins.forEach((m, side) => {
    const mid = Math.round((m.x0 + m.x1) / 2);
    for (let y = roof + 70 + side * 50; y < H - 30; y += CAVE_GAP + Math.floor(rand() * 60)) {
      const rx = Math.min((m.x1 - m.x0) / 2.8, 9 + rand() * 9);
      cave(world, mid, y, rx, 5 + rand() * 4, rand, { hasCrystals: rand() < 0.4 });
    }
    for (let y = roof + 40 + side * 70; y < H - 20; y += LANTERN_GAP) lamps.push({ x: mid - 2, y });
  });
  for (let k = 0; k < Math.round(H / 60); k += 1) {
    vein(
      world,
      Math.floor(rand() * W),
      roof + 20 + Math.floor(rand() * (H - roof - 30)),
      3,
      rand,
      4,
    );
  }
  edges(world, roof, H);
  const spiders = webs(world, roof + 1);
  return { world, lamps, spiders };
}

function fireflies(W: number, H: number, rand: () => number): Firefly[] {
  return Array.from({ length: Math.max(6, Math.round((W * H) / FIREFLY_AREA)) }, () => ({
    x: rand() * W,
    y: rand() * H,
    phase: rand() * 6,
    speed: 0.3 + rand() * 0.5,
    drift: 4 + rand() * 6,
  }));
}

function staticLights(world: World, lamps: readonly WallLamp[]): Light[] {
  return [
    ...lamps.map(
      (l): Light => ({
        x: l.x + 2,
        y: l.y + 3,
        radius: 40,
        intensity: 0.55,
        color: LANTERN,
        falloff: 1.8,
      }),
    ),
    ...glowLights(world, 0),
  ];
}

function drawFireflies(
  view: View,
  sprites: Sprites,
  flies: readonly Firefly[],
  time: number,
): void {
  const ctx = view.front;
  if (!ctx) return;
  const bright = sprites.tone("ore-hi");
  const soft = sprites.tone("ore-lo");
  for (const f of flies) {
    const glow = Math.sin(time * 2.2 + f.phase);
    if (glow < -0.2) continue;
    const x = Math.round(f.x + Math.sin(time * f.speed + f.phase) * f.drift);
    const y = Math.round(f.y + Math.cos(time * f.speed * 0.8 + f.phase) * f.drift) - view.camY;
    ctx.globalAlpha = Math.min(1, 0.4 + glow);
    ctx.fillStyle = soft;
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x, y - 1, 1, 3);
    ctx.fillStyle = bright;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawSpiders(
  view: View,
  sprites: Sprites,
  spiders: readonly Spider[],
  time: number,
  art: HTMLCanvasElement,
): void {
  const { ctx } = view;
  ctx.fillStyle = sprites.tone("star-dim");
  for (const s of spiders) {
    if (!view.isVisible(s.top, 30)) continue;
    const drop = (Math.sin(time * 0.6 + s.phase) * 0.5 + 0.5) * s.span;
    const y = Math.round(s.top + drop) - view.camY;
    ctx.fillRect(s.x + 2, s.top - view.camY, 1, Math.max(0, y - (s.top - view.camY)));
    ctx.drawImage(art, s.x, y);
  }
}

export function startWall(host: WallHost): (() => void) | null {
  const viewWidth = viewportWidth();
  const scale = viewWidth < 768 ? 2 : 3;
  const frames = [host.canvas.parentElement, host.front?.parentElement ?? null];
  const docHeight = pageHeight();
  for (const frame of frames) if (frame) frame.style.height = `${docHeight}px`;
  const W = Math.ceil(viewWidth / scale);
  const H = Math.ceil(docHeight / scale) + 2;
  const roof = Math.ceil(host.roofY / scale);
  if (W < 20 || H < roof + 20) return null;
  const palette = readDeepPalette(host.paletteSource);
  const safe = { x0: Math.floor(host.safe.x0 / scale), x1: Math.ceil(host.safe.x1 / scale) };
  const { world, lamps, spiders } = buildWall(W, H, roof, safe, palette);
  const view = createView(
    host.canvas,
    host.mid,
    host.front,
    world,
    scale,
    window.innerHeight,
    WALL_AMBIENT,
  );
  if (!view) return null;
  view.bake(staticLights(world, lamps));
  const sprites = createSprites(world);
  const spiderArt = document.createElement("canvas");
  spiderArt.width = (SPIDER_ART[0] ?? "").length;
  spiderArt.height = SPIDER_ART.length;
  const sctx = spiderArt.getContext("2d");
  if (sctx) {
    SPIDER_ART.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        sctx.fillStyle = toneHex(palette, ch === "e" ? "bat-eye" : "lantern-off-hi");
        sctx.fillRect(x, y, 1, 1);
      });
    });
  }
  const drips = createDrips(world, seeded(32));
  const flies = fireflies(W, H - roof, seeded(33)).map((f) => ({ ...f, y: f.y + roof }));
  let time = 0;

  const sim = (dt: number) => {
    time += dt;
    drips.update(dt);
  };
  const render = () => {
    view.render([]);
    drawGlows(view, world, sprites, time);
    drawVeinGlints(view, world, sprites, time);
    for (const l of lamps) {
      if (view.isVisible(l.y, 8)) view.ctx.drawImage(sprites.lantern.on, l.x, l.y - view.camY);
    }
    drawSpiders(view, sprites, spiders, time, spiderArt);
    drips.draw(view);
    if (view.front && !host.isCalm) drawFireflies(view, sprites, flies, time);
  };

  if (host.isStatic) {
    for (let i = 0; i < 120; i += 1) sim(STEP);
    let pending = 0;
    const onScroll = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        render();
      });
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
    frame += 1;
    if ((frame & 1) === 0 || window.scrollY !== lastScroll) {
      lastScroll = window.scrollY;
      render();
    }
    handle = requestAnimationFrame(loop);
  };
  let frame = 0;
  let lastScroll = -1;
  handle = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(handle);
}
