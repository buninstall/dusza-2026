import type { MineMap } from "@minescript/engine";
import type { BoardShade } from "../MineBoard.tsx";
import type { Exploration, TileKind } from "../tiles-model.ts";
import type { View } from "./camera.ts";
import { type Burst, drawEmissive, type Glint, overlayEmissive } from "./emissive.ts";
import { type SceneLayout, sceneLayout, T } from "./layout.ts";
import { createLightField, type LightField } from "./light.ts";
import { createMotes, drawMotes, type Mote, stepMotes } from "./motes.ts";
import { kindsOf, paintBoard, SIGHT_KNOWN, sightOf } from "./paint-board.ts";
import { cartLevel, paintFixtures } from "./paint-fixtures.ts";
import { paintRulers, paintWorld, type RulerFlags } from "./paint-world.ts";
import { buildAmbient, PRESETS, type Preset, type SceneLighting } from "./presets.ts";
import {
  addRobotLights,
  type BakedFixture,
  bakeFixtures,
  type RobotLight,
  readRobot,
} from "./robot-light.ts";
import { readRustLevel, rustify } from "./rust.ts";
import { type Colors, readColors } from "./scene-art.ts";
import { shadeView } from "./shade.ts";

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
  destroy: () => void;
};

const IDLE_FRAME_MS = 45;
const RUST_CHECK_MS = 2000;
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
  const emis = canvasOf(1, 1);
  const emisCtx = emis.getContext("2d", { willReadFrequently: true });
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
  let isDirty = true;
  let walls = "";
  let mined = new Set<number>();
  let painted = "";
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
    motes = createMotes(layout);
    return world;
  };

  const repaint = (w: World, next: SceneInput) => {
    const staticCtx = w.canvas.getContext("2d", { willReadFrequently: true });
    if (!staticCtx) {
      return;
    }
    staticCtx.drawImage(w.rock, 0, 0);
    paintBoard(staticCtx, w.layout, colors, w.kinds, w.face);
    paintRulers(staticCtx, w.layout, colors, next.flags);
    const minedCount = w.kinds.filter((kind) => kind === "mined").length;
    const goldCount = minedCount + w.kinds.filter((kind) => kind === "gold").length;
    paintFixtures(staticCtx, w.layout, colors, preset, cartLevel(minedCount, goldCount));
    w.albedo = staticCtx.getImageData(0, 0, w.layout.W, w.layout.H).data;
    rustLevel = readRustLevel(host);
    rustify(w.albedo, w.layout, colors, rustLevel);
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
    w.sight = sightOf(next.map, next.exploration, next.robotKey);
    input = next;
    const paintKey = `${next.lighting}|${kinds.join(",")}|${[...(next.flags?.rows ?? [])].join(",")}|${[...(next.flags?.cols ?? [])].join(",")}|${w.layout.cols}x${w.layout.rows}`;
    if (paintKey !== painted) {
      painted = paintKey;
      repaint(w, next);
    }
    isDirty = true;
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

  const render = (time: number, w: World, v: View) => {
    if (!ctx || !emisCtx || !input) {
      return;
    }
    if (!output || output.width !== v.width || output.height !== v.height) {
      output = ctx.createImageData(v.width, v.height);
      emis.width = v.width;
      emis.height = v.height;
    }
    w.field.clear();
    addRobotLights(w.field, w.layout, w.baked, preset, {
      time,
      isStill,
      robot,
      shade: input.shade,
      lighting: input.lighting,
      bursts,
      contained: containedIn(w),
    });
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
    shadeView(output.data, v, worldData, w.field, board, look);
    drawEmissive(emisCtx, v, w.layout, colors, preset, {
      time,
      isStill,
      bursts,
      glints,
      flags: input.flags,
    });
    overlayEmissive(output.data, emisCtx.getImageData(0, 0, v.width, v.height).data);
    if (!isStill) {
      drawMotes(output.data, v, motes, w.field, colors.rgb("lamp"), time);
    }
    ctx.putImageData(output, 0, 0);
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
        isDirty = true;
      }
    }
    const nextRobot = readRobot(host, canvas, v);
    const hasMoved =
      nextRobot?.x !== robot?.x || nextRobot?.y !== robot?.y || nextRobot?.angle !== robot?.angle;
    robot = nextRobot;
    const isLive = !isStill && (preset.lanterns > 0 || preset.bulbs > 0 || bursts.length > 0);
    if (!isDirty && !hasMoved && !(isLive && now - last >= IDLE_FRAME_MS)) {
      return;
    }
    step(Math.min((now - (last || now)) / 1000, 0.1), w);
    last = now;
    isDirty = false;
    render(now / 1000, w, v);
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
      isDirty = true;
    },
    destroy: () => cancelAnimationFrame(frame),
  };
}
