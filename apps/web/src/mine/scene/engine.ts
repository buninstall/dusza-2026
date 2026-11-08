import type { MineMap } from "@minescript/engine";
import type { BoardShade } from "../MineBoard.tsx";
import type { Exploration, TileKind } from "../tiles-model.ts";
import type { View } from "./camera.ts";
import {
  pointRect,
  tileRect,
  toBlockRect,
  viewRects,
  viewWorldRect,
  type WorldRect,
} from "./dirty.ts";
import { type Burst, drawEmissive, type Glint } from "./emissive.ts";
import { drawGhost, type GhostPath } from "./ghost.ts";
import { type SceneLayout, sceneLayout, T } from "./layout.ts";
import { createLightField, type LightField } from "./light.ts";
import { createMotes, drawMotes, type Mote, motePixel, stepMotes } from "./motes.ts";
import { kindsOf, paintBoard, SIGHT_KNOWN, seedSeen, sightFromSeen } from "./paint-board.ts";
import { cartLevel, paintFixtures } from "./paint-fixtures.ts";
import { paintRulers, paintWorld, type RulerFlags } from "./paint-world.ts";
import { buildAmbient, PRESETS, type Preset, type SceneLighting } from "./presets.ts";
import {
  addRobotLights,
  type BakedFixture,
  bakeFixtures,
  bakeRobotLamp,
  burstBox,
  fixtureBox,
  isFlickering,
  type RobotLamp,
  type RobotLight,
  readRobot,
  robotBox,
} from "./robot-light.ts";
import { applyRust, type RustPatch, readRustLevel, rustPatch } from "./rust.ts";
import { type Colors, readColors } from "./scene-art.ts";
import { shadeView, type ViewRect } from "./shade.ts";

export type SceneInput = {
  map: MineMap;
  exploration: Exploration | null;
  shade: BoardShade | null;
  lighting: SceneLighting;
  flags: RulerFlags | undefined;
  robotKey: string | null;
};

export type SceneEngine = {
  layoutFor: (cols: number, rows: number) => SceneLayout;
  setInput: (input: SceneInput) => void;
  setView: (view: View) => void;
  setGhost: (ghost: GhostPath | null) => void;
  destroy: () => void;
};

const IDLE_FRAME_MS = 45;
const RUST_CHECK_MS = 2000;
const SEEN_LIGHT = 0.2;
const CART_DROP_MS = 1170;
const BURST_S = 0.6;
const GLINT_S = 0.5;
const GLINT_RATE = 0.6;

type World = {
  layout: SceneLayout;
  rock: HTMLCanvasElement;
  canvas: HTMLCanvasElement;
  albedo: Uint8ClampedArray;
  face: Uint8Array;
  field: LightField;
  ambient: Float32Array;
  baked: BakedFixture[];
  kinds: TileKind[];
  sight: Uint8Array;
};

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function wallKey(kinds: readonly TileKind[]): string {
  return kinds.map((kind) => (kind === "wall" ? "1" : "0")).join("");
}

export function createSceneEngine(canvas: HTMLCanvasElement, host: HTMLElement): SceneEngine {
  const ctx = canvas.getContext("2d");
  const isStill = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors: Colors = readColors(host);
  let world: World | null = null;
  let input: SceneInput | null = null;
  let preset: Preset = PRESETS.open;
  let view: View | null = null;
  let output: ImageData | null = null;
  let bursts: Burst[] = [];
  let glints: Glint[] = [];
  let motes: Mote[] = [];
  let robot: RobotLight | null = null;
  let frame = 0;
  let last = 0;
  let needsFull = true;
  let pending: WorldRect[] = [];
  let lastRobotBox: WorldRect | null = null;
  let flickerTime = 0;
  let ghost: GhostPath | null = null;
  let patch: RustPatch | null = null;
  let paintedLook = "";
  let robotLamp: RobotLamp | null = null;
  let isLampStale = true;
  let walls = "";
  let mined = new Set<number>();
  let painted = "";
  let seen = new Uint8Array(0);
  let shownMined = 0;
  let cartDue = 0;
  let discoveredSize = 0;
  let seenLighting = "";
  let rustLevel = 0;
  let rustCheck = 0;

  const isSolid = (layout: SceneLayout, kinds: readonly TileKind[]) => (x: number, y: number) => {
    const c = Math.floor((x - layout.bx) / T);
    const r = Math.floor((y - layout.by) / T);
    return (
      c >= 0 &&
      r >= 0 &&
      c < layout.cols &&
      r < layout.rows &&
      kinds[r * layout.cols + c] === "wall"
    );
  };

  const containedIn = (w: World) => {
    const walls = isSolid(w.layout, w.kinds);
    const { bx, by, bw, bh } = w.layout;
    return (x: number, y: number) =>
      x < bx || y < by || x >= bx + bw || y >= by + bh || walls(x, y);
  };

  const ensureWorld = (map: MineMap): World => {
    if (world && world.layout.cols === map.cols && world.layout.rows === map.rows) {
      return world;
    }
    const layout = sceneLayout(map.cols, map.rows);
    const rock = canvasOf(layout.W, layout.H);
    const rockCtx = rock.getContext("2d");
    if (rockCtx) {
      paintWorld(rockCtx, layout, colors);
    }
    const kinds: TileKind[] = [];
    world = {
      layout,
      rock,
      canvas: canvasOf(layout.W, layout.H),
      albedo: new Uint8ClampedArray(layout.W * layout.H * 4),
      face: new Uint8Array(layout.W * layout.H),
      field: createLightField(layout.W, layout.H, isSolid(layout, kinds)),
      ambient: new Float32Array(0),
      baked: [],
      kinds,
      sight: new Uint8Array(map.rows * map.cols),
    };
    walls = "";
    painted = "";
    paintedLook = "";
    patch = null;
    motes = createMotes(layout);
    return world;
  };

  const repaint = (w: World, next: SceneInput, isPartial = false) => {
    const staticCtx = w.canvas.getContext("2d", { willReadFrequently: true });
    if (!staticCtx) {
      return;
    }
    staticCtx.drawImage(w.rock, 0, 0);
    paintBoard(staticCtx, w.layout, colors, w.kinds, w.face);
    paintRulers(staticCtx, w.layout, colors, next.flags);
    const goldCount = shownMined + w.kinds.filter((kind) => kind === "gold").length;
    paintFixtures(staticCtx, w.layout, colors, preset, cartLevel(shownMined, goldCount));
    const { layout } = w;
    if (isPartial && patch && w.albedo.length === layout.W * layout.H * 4) {
      const x0 = layout.bx;
      const y0 = layout.cart.y - 8;
      const x1 = Math.min(layout.W, layout.cart.x + 32);
      const y1 = Math.min(layout.H, Math.max(layout.by + layout.bh, layout.cart.y + 20));
      const top = Math.min(layout.by, y0);
      const part = staticCtx.getImageData(x0, top, x1 - x0, y1 - top).data;
      const rowBytes = (x1 - x0) * 4;
      for (let y = top; y < y1; y += 1) {
        w.albedo.set(
          part.subarray((y - top) * rowBytes, (y - top + 1) * rowBytes),
          (y * layout.W + x0) * 4,
        );
      }
      applyRust(w.albedo, patch);
      return;
    }
    w.albedo = staticCtx.getImageData(0, 0, layout.W, layout.H).data;
    rustLevel = readRustLevel(host);
    patch = rustPatch(w.albedo, layout, colors, rustLevel);
    applyRust(w.albedo, patch);
  };

  const noteMined = (w: World) => {
    const now = new Set<number>();
    w.kinds.forEach((kind, index) => {
      if (kind === "mined") {
        now.add(index);
        if (!mined.has(index)) {
          bursts.push({ c: index % w.layout.cols, r: Math.floor(index / w.layout.cols), t: 0 });
        }
      }
    });
    mined = now;
  };

  const setInput = (next: SceneInput) => {
    const w = ensureWorld(next.map);
    const kinds = kindsOf(next.map, next.exploration);
    w.kinds.splice(0, w.kinds.length, ...kinds);
    const actualMined = kinds.filter((kind) => kind === "mined").length;
    if (input !== null && actualMined > shownMined && !isStill) {
      cartDue = performance.now() + CART_DROP_MS;
    } else {
      shownMined = actualMined;
      cartDue = 0;
    }
    const nextPreset = PRESETS[next.lighting];
    const isNewLook = nextPreset !== preset || w.ambient.length === 0;
    preset = nextPreset;
    if (input !== null) {
      noteMined(w);
    } else {
      mined = new Set(kinds.flatMap((kind, index) => (kind === "mined" ? [index] : [])));
    }
    const nextWalls = wallKey(kinds);
    if (nextWalls !== walls || isNewLook) {
      walls = nextWalls;
      w.baked = bakeFixtures(w.field, w.layout, preset);
    }
    if (isNewLook) {
      w.ambient = buildAmbient(w.layout, w.field, preset);
    }
    const tiles = next.map.rows * next.map.cols;
    const discovered = next.exploration?.discovered.size ?? 0;
    if (
      seen.length !== tiles ||
      next.lighting !== seenLighting ||
      discovered < discoveredSize ||
      next.shade?.isBroken
    ) {
      seen = new Uint8Array(tiles);
    }
    discoveredSize = discovered;
    seenLighting = next.lighting;
    seedSeen(seen, next.map, next.exploration, next.robotKey);
    applySight(w, sightFromSeen(seen, preset.memory === 0, next.exploration?.mode === "full"));
    if (next.lighting !== input?.lighting || next.shade?.isBroken !== input?.shade?.isBroken) {
      needsFull = true;
    }
    input = next;
    isLampStale = true;
    const paintKey = `${next.lighting}|${kinds.join(",")}|${[...(next.flags?.rows ?? [])].join(",")}|${[...(next.flags?.cols ?? [])].join(",")}|${w.layout.cols}x${w.layout.rows}`;
    if (paintKey !== painted) {
      painted = paintKey;
      const look = `${next.lighting}|${[...(next.flags?.rows ?? [])].join(",")}|${[...(next.flags?.cols ?? [])].join(",")}|${w.layout.cols}x${w.layout.rows}|${wallKey(kinds)}`;
      repaint(w, next, look === paintedLook);
      paintedLook = look;
      needsFull = true;
    }
  };

  const applySight = (w: World, next: Uint8Array) => {
    if (next.length !== w.sight.length) {
      w.sight = next;
      needsFull = true;
      return;
    }
    next.forEach((value, index) => {
      if (value !== w.sight[index]) {
        pending.push(tileRect(w.layout, index));
      }
    });
    w.sight = next;
  };

  const markLit = (w: World) => {
    const { bx, by, cols, rows } = w.layout;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = bx + c * T;
        const y = by + r * T;
        const lit = Math.max(
          w.field.at(x + 8, y + 8),
          w.field.at(x + 3, y + 3),
          w.field.at(x + 12, y + 12),
        );
        if (lit > SEEN_LIGHT) {
          seen[r * cols + c] = 1;
        }
      }
    }
  };

  const step = (dt: number, w: World) => {
    bursts = bursts.map((b) => ({ ...b, t: b.t + dt })).filter((b) => b.t < BURST_S);
    glints = glints.map((g) => ({ ...g, t: g.t + dt })).filter((g) => g.t < GLINT_S);
    if (!isStill) {
      stepMotes(motes, dt);
      w.kinds.forEach((kind, index) => {
        if (kind !== "gold" || w.sight[index] !== SIGHT_KNOWN || Math.random() > dt * GLINT_RATE) {
          return;
        }
        const x = w.layout.bx + (index % w.layout.cols) * T + 5 + Math.floor(Math.random() * 6);
        const y =
          w.layout.by + Math.floor(index / w.layout.cols) * T + 5 + Math.floor(Math.random() * 5);
        if (w.field.at(x, y) > 0.3) {
          glints.push({ x, y, t: 0 });
        }
      });
    }
  };

  const rebuildLight = (w: World, rects: readonly ViewRect[], v: View, isFull: boolean) => {
    if (!input) {
      return;
    }
    const contained = containedIn(w);
    if (isLampStale) {
      robotLamp = bakeRobotLamp(w.field, {
        robot,
        lighting: input.lighting,
        shade: input.shade,
        contained,
      });
      isLampStale = false;
    }
    const scene = {
      time: flickerTime,
      isStill,
      robot,
      shade: input.shade,
      lighting: input.lighting,
      bursts,
      contained,
      lamp: robotLamp,
    };
    if (isFull) {
      w.field.clear();
      addRobotLights(w.field, w.layout, w.baked, preset, scene);
      return;
    }
    for (const rect of rects) {
      const blocks = toBlockRect(rect, v);
      w.field.clearBlocks(blocks);
      addRobotLights(w.field, w.layout, w.baked, preset, scene, blocks);
    }
  };

  const effectBoxes = (w: World): WorldRect[] => [
    ...bursts.map((burst) => burstBox(w.layout, burst)),
    ...glints.map((glint) => pointRect(glint.x, glint.y, 3)),
  ];

  const moteDots = (): { x: number; y: number }[] => (isStill ? [] : motes.map(motePixel));

  const render = (
    time: number,
    w: World,
    v: View,
    world: WorldRect[],
    isFull: boolean,
    dots: readonly { x: number; y: number }[],
  ) => {
    if (!ctx || !input || v.width <= 0 || v.height <= 0) {
      return;
    }
    if (!output || output.width !== v.width || output.height !== v.height) {
      output = ctx.createImageData(v.width, v.height);
    }
    const full: ViewRect[] = [{ x0: 0, y0: 0, x1: v.width, y1: v.height }];
    let rects = isFull ? full : viewRects(world, v);
    if (rects.length === 0) {
      return;
    }
    rebuildLight(w, rects, v, rects === full);
    if (preset.memory > 0) {
      markLit(w);
      applySight(w, sightFromSeen(seen, false, input.exploration?.mode === "full"));
      if (pending.length > 0 && rects !== full) {
        rects = viewRects([...world, ...pending], v);
        pending = [];
      }
    }
    const board = {
      bx: w.layout.bx,
      by: w.layout.by,
      cols: w.layout.cols,
      rows: w.layout.rows,
      sight: w.sight,
    };
    const look = {
      levels: preset.levels,
      memory: preset.memory,
      shroud: preset.shroud,
      hidden: preset.hidden,
      base: colors.rgb("void"),
      haze: colors.rgb("beam"),
    };
    const worldData = {
      W: w.layout.W,
      H: w.layout.H,
      albedo: w.albedo,
      face: w.face,
      ambient: w.ambient,
    };
    ctx.save();
    ctx.beginPath();
    for (const rect of rects) {
      shadeView(output.data, v, worldData, w.field, board, look, rect);
      ctx.putImageData(output, 0, 0, rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
      ctx.rect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    }
    if (rects !== full) {
      const data = output.data;
      for (const dot of dots) {
        const x = dot.x - v.x;
        const y = dot.y - v.y;
        if (x < 0 || y < 0 || x >= v.width || y >= v.height) {
          continue;
        }
        shadeView(data, v, worldData, w.field, board, look, { x0: x, y0: y, x1: x + 1, y1: y + 1 });
        const o = (y * v.width + x) * 4;
        ctx.fillStyle = `rgb(${data[o]},${data[o + 1]},${data[o + 2]})`;
        ctx.fillRect(x, y, 1, 1);
        ctx.rect(x, y, 1, 1);
      }
    }
    ctx.clip();
    ctx.globalCompositeOperation = "lighten";
    drawEmissive(ctx, v, w.layout, colors, preset, {
      time: flickerTime,
      isStill,
      bursts,
      glints,
      flags: input.flags,
    });
    if (ghost) {
      ctx.translate(-v.x, -v.y);
      drawGhost(ctx, w.layout, colors, w.sight, ghost);
      ctx.translate(v.x, v.y);
    }
    ctx.globalCompositeOperation = "source-over";
    if (!isStill) {
      drawMotes(ctx, v, motes, w.field, colors.css("lamp"), time);
    }
    ctx.restore();
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const w = world;
    const v = view;
    if (!w || !v || document.hidden) {
      return;
    }
    if (input && now - rustCheck > RUST_CHECK_MS) {
      rustCheck = now;
      if (readRustLevel(host) !== rustLevel) {
        repaint(w, input);
        needsFull = true;
      }
    }
    if (cartDue > 0 && now >= cartDue && input) {
      cartDue = 0;
      shownMined = w.kinds.filter((kind) => kind === "mined").length;
      repaint(w, input, true);
      needsFull = true;
    }
    const nextRobot = readRobot(host, canvas, v);
    const hasMoved =
      nextRobot?.x !== robot?.x || nextRobot?.y !== robot?.y || nextRobot?.angle !== robot?.angle;
    robot = nextRobot;
    if (hasMoved) {
      isLampStale = true;
    }
    const isLive = !isStill && (preset.lanterns > 0 || preset.bulbs > 0 || bursts.length > 0);
    const isFlickerDue = isLive && now - last >= IDLE_FRAME_MS;
    if (!needsFull && pending.length === 0 && !hasMoved && !isFlickerDue) {
      return;
    }
    const before = effectBoxes(w);
    const dotsBefore = moteDots();
    step(Math.min((now - (last || now)) / 1000, 0.1), w);
    if (isFlickerDue || needsFull) {
      flickerTime = now / 1000;
      last = now;
    }
    const scene = input ? { lighting: input.lighting, shade: input.shade } : null;
    const box = scene ? robotBox(robot, scene) : null;
    const flickers = isFlickerDue
      ? w.baked.filter((fixture) => isFlickering(fixture, preset)).map(fixtureBox)
      : [];
    const rects: WorldRect[] = [
      ...pending,
      ...(hasMoved && lastRobotBox ? [lastRobotBox] : []),
      ...(hasMoved && box ? [box] : []),
      ...flickers,
      ...before,
      ...effectBoxes(w),
    ];
    pending = [];
    lastRobotBox = box;
    const isFull = needsFull;
    needsFull = false;
    render(now / 1000, w, v, isFull ? [viewWorldRect(v)] : rects, isFull, [
      ...dotsBefore,
      ...moteDots(),
    ]);
  };
  frame = requestAnimationFrame(tick);

  return {
    layoutFor: (cols, rows) =>
      world && world.layout.cols === cols && world.layout.rows === rows
        ? world.layout
        : sceneLayout(cols, rows),
    setInput,
    setView: (next) => {
      view = next;
      if (canvas.width !== next.width || canvas.height !== next.height) {
        canvas.width = next.width;
        canvas.height = next.height;
      }
      needsFull = true;
    },
    setGhost: (next) => {
      ghost = next;
      needsFull = true;
    },
    destroy: () => cancelAnimationFrame(frame),
  };
}
