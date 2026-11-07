import { rotateTimes } from "../../pixel/pixel-art.ts";
import {
  BURST_ART,
  DUG_ART,
  FLOOR_ART,
  FLOOR_TONES,
  GOLD_ART,
  ORE_TONES,
  ROBOT_ART,
  ROBOT_TONES,
  SCAN_ART,
  WALL_ART,
  WALL_TONES,
} from "../../pixel/tiles.ts";
import { type Palette, readPalette, spriteCanvas, toneColor } from "./canvas-art.ts";
import { type Box, LANTERN_ART, LANTERN_DIM_TONES, LANTERN_TONES, paintFrame } from "./frame.ts";
import {
  allocate,
  fitsLive,
  lanternSpots,
  type Metrics,
  type Placement,
  place,
  type Rect,
  repaintRect,
  TILE,
} from "./layout.ts";
import { createLighting, type Light } from "./lighting.ts";
import {
  type Cell,
  FLOOR,
  GOLD,
  generateMine,
  HOLE,
  isOpen,
  type Mine,
  planTour,
  ROCK,
  seeded,
} from "./mine.ts";
import { createWalker, MINE_HIT } from "./walker.ts";

export type SceneHost = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  panel: HTMLElement;
  isStatic: boolean;
};

const T = TILE;
const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const STATIC_WARMUP = 14;
const MEMORY_FADE = 0.012;
const REVEAL_RATE = 2.2;
const FLOOD_SPEED = 150;
const SEEN_LIGHT = 0.16;
const LAMP_COLOR = [1, 0.88, 0.64] as const;
const HALO_COLOR = [1, 0.86, 0.66] as const;
const LANTERN_COLOR = [1, 0.7, 0.4] as const;
const BURST_COLOR = [1, 0.84, 0.42] as const;
const WALL_VARIANT_B = [...WALL_ART.slice(8), ...WALL_ART.slice(0, 8)];
const ROBOT_BODY_TONES = Object.fromEntries(
  Object.entries(ROBOT_TONES).filter(([key]) => key !== "B"),
);
const ROBOT_TREAD_B = ROBOT_ART.map((row) =>
  row.replaceAll("t", "#").replaceAll("r", "t").replaceAll("#", "r"),
);

function variant(c: number, r: number, count: number): number {
  return Math.abs((r * 73856093) ^ (c * 19349663)) % count;
}

function readScale(root: HTMLElement): number {
  const value = Number.parseInt(getComputedStyle(root).getPropertyValue("--lamp-scale"), 10);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

function readMetrics(host: SceneHost): Metrics {
  return {
    width: host.root.clientWidth,
    height: host.root.clientHeight,
    left: host.panel.offsetLeft,
    top: host.panel.offsetTop,
    panelWidth: host.panel.offsetWidth,
    panelHeight: host.panel.offsetHeight,
  };
}

function isSameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export type LampScene = { stop: () => void; relayout: () => boolean };

const IDLE_SCENE: LampScene = { stop: () => undefined, relayout: () => false };

function chooseStart(mine: Mine, hole: { c0: number; c1: number; r0: number; r1: number }): Cell {
  const midRow = Math.floor((hole.r0 + hole.r1) / 2);
  const midCol = Math.floor((hole.c0 + hole.c1) / 2);
  const candidates: Cell[] = [
    [hole.c0 - 1, midRow],
    [midCol, hole.r0 - 1],
    [hole.c1 + 1, midRow],
    [midCol, hole.r1 + 1],
  ];
  return candidates.find(([c, r]) => isOpen(mine.at(c, r))) ?? candidates[1] ?? [1, 1];
}

export function startLampScene(host: SceneHost): LampScene {
  const ctx = host.canvas.getContext("2d", { willReadFrequently: true });
  const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx || !paint) {
    return IDLE_SCENE;
  }
  const scale = readScale(host.root);
  let placement: Placement = place(readMetrics(host), scale);
  const origin = placement.box;
  const area = placement.view;
  if (area.w < 8 || area.h < 8 || origin.w < 8) {
    return IDLE_SCENE;
  }
  const { w: W, h: H } = allocate(area);
  let box = origin;
  const palette: Palette = readPalette(host.canvas);
  const positionCanvas = () => {
    Object.assign(host.canvas.style, {
      left: `${placement.offsetX}px`,
      top: `${placement.offsetY}px`,
      width: `${W * scale}px`,
      height: `${H * scale}px`,
    });
  };
  positionCanvas();
  host.canvas.width = W;
  host.canvas.height = H;
  paint.canvas.width = W;
  paint.canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const cols = Math.ceil(W / T);
  const rows = Math.ceil(H / T);
  const isNarrow = origin.x < T * 2 || area.w - (origin.x + origin.w) < T * 2;
  const hole = {
    c0: Math.floor(origin.x / T),
    c1: Math.floor((origin.x + origin.w - 1) / T),
    r0: Math.floor(origin.y / T),
    r1: Math.floor((origin.y + origin.h - 1) / T),
  };
  const mine = generateMine({
    cols: Math.ceil(area.w / T),
    rows: Math.ceil(area.h / T),
    hole,
    seed: isNarrow ? 21 : 7,
    branchEvery: isNarrow ? 4 : 6,
    upward: isNarrow,
  });
  const mineIndex = (c: number, r: number) => r * mine.cols + c;
  const start = chooseStart(mine, hole);
  if (!isOpen(mine.at(start[0], start[1])) && start[0] > 0 && start[1] > 0) {
    mine.grid[mineIndex(start[0], start[1])] = FLOOR;
  }
  const legs = planTour(mine, start, [(hole.c0 + hole.c1) / 2, (hole.r0 + hole.r1) / 2]);
  const tileAt = (c: number, r: number) => mine.at(c, r);

  const tiles = {
    floor: FLOOR_ART.map((art) => spriteCanvas(art, FLOOR_TONES, palette)),
    wall: [WALL_ART, WALL_VARIANT_B].map((art) => spriteCanvas(art, WALL_TONES, palette)),
    gold: spriteCanvas(GOLD_ART, ORE_TONES, palette),
    dug: spriteCanvas(DUG_ART, { p: "dug", l: "floor-lo" }, palette),
    scan: spriteCanvas(SCAN_ART, { s: "lamp" }, palette),
    burst: BURST_ART.map((art) => spriteCanvas(art, { w: "glint", y: "ore-hi" }, palette)),
    lantern: spriteCanvas(LANTERN_ART, LANTERN_TONES, palette),
    lanternDim: spriteCanvas(LANTERN_ART, LANTERN_DIM_TONES, palette),
  };
  const robotFrames = [ROBOT_ART, ROBOT_TREAD_B].map((art) =>
    [0, 1, 2, 3].map((q) => spriteCanvas(rotateTimes(art, q), ROBOT_BODY_TONES, palette)),
  );
  const dug = new Set<number>();

  const paintTile = (c: number, r: number) => {
    const x = c * T;
    const y = r * T;
    const tile = tileAt(c, r);
    if (tile === ROCK || tile === HOLE) {
      const wall = tiles.wall[variant(c, r, 2)];
      if (wall) paint.drawImage(wall, x, y);
      return;
    }
    const floor = tiles.floor[variant(c, r, 3)];
    if (floor) paint.drawImage(floor, x, y);
    if (tile === GOLD) paint.drawImage(tiles.gold, x, y);
    if (dug.has(r * cols + c)) paint.drawImage(tiles.dug, x, y);
  };

  const paintEdges = (c: number, r: number) => {
    const tile = tileAt(c, r);
    if (tile !== ROCK && tile !== HOLE) return;
    paint.fillStyle = toneColor(palette, "mortar");
    if (isOpen(tileAt(c, r + 1))) paint.fillRect(c * T, r * T + T - 2, T, 2);
    if (isOpen(tileAt(c + 1, r))) paint.fillRect(c * T + T - 1, r * T, 1, T);
    paint.fillStyle = toneColor(palette, "wall-hi");
    if (isOpen(tileAt(c, r - 1))) paint.fillRect(c * T, r * T, T, 1);
  };

  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) paintTile(c, r);
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) paintEdges(c, r);
  paintFrame(paint, palette, box);
  const albedo = paint.getImageData(0, 0, W, H).data;

  const copyToAlbedo = (rect: Rect) => {
    const width = rect.x1 - rect.x0;
    const height = rect.y1 - rect.y0;
    if (width <= 0 || height <= 0) return;
    const patch = paint.getImageData(rect.x0, rect.y0, width, height).data;
    for (let y = 0; y < height; y += 1) {
      const from = y * width * 4;
      albedo.set(patch.subarray(from, from + width * 4), ((rect.y0 + y) * W + rect.x0) * 4);
    }
  };

  const touchesFrame = (rect: Rect) =>
    rect.x0 <= box.x + box.w &&
    rect.x1 >= box.x - 1 &&
    rect.y0 <= box.y + box.h &&
    rect.y1 >= box.y - 1;

  const refreshTile = (c: number, r: number) => {
    paintTile(c, r);
    const rect = { x0: c * T, y0: r * T, x1: Math.min(W, c * T + T), y1: Math.min(H, r * T + T) };
    if (touchesFrame(rect)) paintFrame(paint, palette, box);
    copyToAlbedo(rect);
  };

  const repaintFrame = (previous: Box) => {
    const rect = repaintRect(previous, box, { w: W, h: H });
    for (let r = rect.y0 / T; r * T < rect.y1; r += 1) {
      for (let c = rect.x0 / T; c * T < rect.x1; c += 1) {
        paintTile(c, r);
        paintEdges(c, r);
      }
    }
    paintFrame(paint, palette, box);
    copyToAlbedo(rect);
  };

  const inBox = (x: number, y: number) =>
    x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
  const isSolid = (x: number, y: number) => {
    if (inBox(x, y)) return true;
    const tile = tileAt(Math.floor(x / T), Math.floor(y / T));
    return tile === ROCK || tile === HOLE;
  };
  const lighting = createLighting(W, H, isSolid, 7);
  const memory = new Float32Array(cols * rows);
  const reveal = new Float32Array(cols * rows);
  const revealAt = new Float32Array(cols * rows).fill(Number.POSITIVE_INFINITY);

  let lanterns = lanternSpots(box, isNarrow);
  const rand = seeded(99);
  const twinkle = mine.golds.map(() => ({ phase: rand() * 4, period: 2.6 + rand() * 2.2 }));
  const motes = Array.from({ length: Math.round((area.w * area.h) / 1300) }, () => ({
    x: rand() * area.w,
    y: rand() * area.h,
    vx: (rand() - 0.5) * 3,
    vy: -0.6 - rand() * 2.2,
    seed: rand() * 9,
  }));
  let bursts: { c: number; r: number; t: number }[] = [];
  let time = 0;

  const walker = createWalker(legs.length > 0 ? legs : [[start, start]], {
    speed: 3.1,
    seed: 11,
    sweepChance: 0.32,
    isGold: (c, r) => tileAt(c, r) === GOLD,
    isJunction: (c, r) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dc = 0, dr = 0]) => isOpen(tileAt(c + dc, r + dr))).length >= 3,
    onMine: (c, r) => {
      mine.grid[mineIndex(c, r)] = FLOOR;
      dug.add(r * cols + c);
      refreshTile(c, r);
      bursts.push({ c, r, t: 0 });
    },
    onLoop: () => {
      for (const [c, r] of mine.golds) {
        mine.grid[mineIndex(c, r)] = GOLD;
        dug.delete(r * cols + c);
        refreshTile(c, r);
      }
    },
  });
  const robot = walker.state;
  const robotCenter = (): Cell => [Math.round(robot.x * T) + 8, Math.round(robot.y * T) + 8];
  const flicker = (seed: number) =>
    0.8 + 0.12 * Math.sin(time * 13 + seed) + 0.08 * Math.sin(time * 31 + seed * 2);
  const isLanternOut = () => time % 7.3 > 6.6 && (time * 20) % 2 < 1;

  const lights = (): Light[] => {
    const [cx, cy] = robotCenter();
    const dx = Math.cos(robot.lamp);
    const dy = Math.sin(robot.lamp);
    const list: Light[] = [
      {
        x: cx + dx * 5,
        y: cy + dy * 5,
        radius: isNarrow ? 120 : 168,
        intensity: 1.35,
        color: LAMP_COLOR,
        falloff: 1.25,
        cone: { dx, dy, half: 0.42, soft: 0.3 },
      },
      { x: cx, y: cy, radius: 38, intensity: 0.62, color: HALO_COLOR, falloff: 1.8 },
    ];
    lanterns.forEach(([lx = 0, ly = 0], index) => {
      const isOut = index === 1 && isLanternOut();
      list.push({
        x: lx + 3,
        y: ly + 4,
        radius: 118,
        intensity: isOut ? 0.04 : 0.85 * flicker(index * 3 + 1),
        color: LANTERN_COLOR,
        falloff: 1.7,
      });
    });
    for (const burst of bursts) {
      const f = Math.max(0, 1 - burst.t / 0.6);
      if (f > 0) {
        list.push({
          x: burst.c * T + 8,
          y: burst.r * T + 8,
          radius: 46,
          intensity: 0.9 * f,
          color: BURST_COLOR,
          falloff: 1.4,
        });
      }
    }
    return list;
  };

  const notice = () => {
    const [cx, cy] = robotCenter();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const k = r * cols + c;
        const lit = Math.max(
          lighting.at(c * T + 4, r * T + 4),
          lighting.at(c * T + 12, r * T + 4),
          lighting.at(c * T + 4, r * T + 12),
          lighting.at(c * T + 12, r * T + 12),
        );
        if (lit <= SEEN_LIGHT) continue;
        if (revealAt[k] === Number.POSITIVE_INFINITY) {
          revealAt[k] = time + Math.hypot(c * T + 8 - cx, r * T + 8 - cy) / FLOOD_SPEED;
        }
        memory[k] = Math.min(1, Math.max(memory[k] ?? 0, lit * 1.6));
      }
    }
  };

  let steps = 0;
  const sim = (dt: number) => {
    time += dt;
    steps += 1;
    walker.update(dt);
    for (const burst of bursts) burst.t += dt;
    bursts = bursts.filter((burst) => burst.t < 0.9);
    for (let k = 0; k < memory.length; k += 1) {
      memory[k] = Math.max(0, (memory[k] ?? 0) - dt * MEMORY_FADE);
      if (time >= (revealAt[k] ?? Number.POSITIVE_INFINITY)) {
        reveal[k] = Math.min(1, (reveal[k] ?? 0) + dt * REVEAL_RATE);
      }
    }
    for (const mote of motes) {
      mote.x += (mote.vx + Math.sin(time * 0.7 + mote.seed) * 1.2) * dt;
      mote.y += mote.vy * dt;
      if (mote.y < -2) mote.y = area.h + 2;
      if (mote.x < -2) mote.x = area.w + 2;
      if (mote.x > area.w + 2) mote.x = -2;
    }
    if (steps % 5 === 0) {
      lighting.compute(lights());
      notice();
    }
  };

  const tileIndex = (x: number, y: number) => Math.floor(y / T) * cols + Math.floor(x / T);
  const frame = ctx.createImageData(W, H);
  const base = [7, 6, 5] as const;

  const drawTwinkles = () => {
    mine.golds.forEach(([c, r], index) => {
      if (tileAt(c, r) !== GOLD) return;
      const tw = twinkle[index];
      if (!tw) return;
      const p = ((time + tw.phase) % tw.period) / tw.period;
      if (p > 0.16 || lighting.at(c * T + 8, r * T + 8) > 0.5) return;
      const x = c * T + 11;
      const y = r * T + 3;
      const size = p < 0.04 || p > 0.12 ? 1 : p < 0.06 || p > 0.1 ? 2 : 3;
      for (const [tone, reach] of [
        ["ore-lo", size],
        ["ore-hi", size - 1],
      ] as const) {
        ctx.fillStyle = toneColor(palette, tone);
        for (let d = 1; d <= reach; d += 1) {
          ctx.fillRect(x - d, y, 1, 1);
          ctx.fillRect(x + d, y, 1, 1);
          ctx.fillRect(x, y - d, 1, 1);
          ctx.fillRect(x, y + d, 1, 1);
        }
      }
      ctx.fillStyle = toneColor(palette, "glint");
      ctx.fillRect(x, y, 1, 1);
    });
  };

  const drawMotes = () => {
    for (const mote of motes) {
      const l = lighting.at(Math.floor(mote.x), Math.floor(mote.y));
      if (l <= 0.42) continue;
      ctx.fillStyle = toneColor(palette, l > 0.8 ? "lamp" : "beam");
      ctx.globalAlpha = Math.min(1, (l - 0.4) * 1.4);
      ctx.fillRect(Math.floor(mote.x), Math.floor(mote.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  };

  const drawLanterns = () => {
    ctx.fillStyle = toneColor(palette, "steel-edge");
    lanterns.forEach(([lx = 0, ly = 0], index) => {
      if (isNarrow) {
        ctx.fillRect(lx + 3, ly + 7, 1, 3);
      } else {
        ctx.fillRect(lx + 3, ly - 3, 1, 3);
        ctx.fillRect(index === 0 ? lx + 3 : lx - 2, ly - 3, 6, 1);
      }
      ctx.drawImage(index === 1 && isLanternOut() ? tiles.lanternDim : tiles.lantern, lx, ly);
    });
  };

  const drawRobot = () => {
    const mining = robot.mining;
    if (mining && mining.t < MINE_HIT && (mining.t * 8) % 2 < 1.3) {
      ctx.drawImage(tiles.scan, mining.c * T, mining.r * T);
    }
    const [cx, cy] = robotCenter();
    const sprite = robotFrames[Math.floor(robot.travel * 4) % 2]?.[robot.dir];
    if (sprite) ctx.drawImage(sprite, cx - 8, cy - 8);
    ctx.fillStyle = toneColor(palette, "glint");
    ctx.fillRect(
      Math.round(cx + Math.cos(robot.lamp) * 6),
      Math.round(cy + Math.sin(robot.lamp) * 6),
      1,
      1,
    );
    for (const burst of bursts) {
      const sprite = tiles.burst[Math.floor((burst.t - 0.02) / 0.12)];
      if (sprite) ctx.drawImage(sprite, burst.c * T, burst.r * T);
    }
  };

  const behindFrame = (draw: () => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
    ctx.clip("evenodd");
    draw();
    ctx.restore();
  };

  const render = () => {
    lighting.compute(lights());
    notice();
    lighting.shade(albedo, frame.data, {
      levels: 5,
      memory: (x, y) => Math.min(memory[tileIndex(x, y)] ?? 0, reveal[tileIndex(x, y)] ?? 0),
      memoryTint: [0.42, 0.46, 0.62],
      memoryLevel: 0.36,
      memoryDensity: 0.5,
      ambient: (x, y) =>
        x >= box.x - 1 && x <= box.x + box.w && y >= box.y - 1 && y <= box.y + box.h ? 0.3 : 0,
      reveal: (x, y) => (inBox(x, y) ? 1 : (reveal[tileIndex(x, y)] ?? 0)),
      base,
      bounds: { width: placement.view.w, height: placement.view.h },
    });
    ctx.putImageData(frame, 0, 0);
    behindFrame(drawTwinkles);
    drawMotes();
    drawLanterns();
    behindFrame(drawRobot);
  };

  const relayout = (): boolean => {
    if (readScale(host.root) !== scale) return false;
    const next = place(readMetrics(host), scale);
    if (!fitsLive({ w: W, h: H }, origin, next)) return false;
    const previous = placement;
    placement = next;
    box = next.box;
    const isShifted = next.offsetX !== previous.offsetX || next.offsetY !== previous.offsetY;
    const isResized = next.view.w !== previous.view.w || next.view.h !== previous.view.h;
    const isMoved = !isSameBox(previous.box, box);
    if (isShifted) positionCanvas();
    if (isMoved) {
      repaintFrame(previous.box);
      lanterns = lanternSpots(box, isNarrow);
    }
    if (isShifted || isResized || isMoved) render();
    return true;
  };

  if (host.isStatic) {
    for (let t = 0; t < STATIC_WARMUP; t += STEP) sim(STEP);
    render();
    return { stop: () => undefined, relayout };
  }

  let handle = 0;
  let last = performance.now();
  let pending = 0;
  const loop = (now: number) => {
    pending += Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    while (pending >= STEP) {
      sim(STEP);
      pending -= STEP;
    }
    render();
    handle = requestAnimationFrame(loop);
  };
  handle = requestAnimationFrame(loop);
  return { stop: () => cancelAnimationFrame(handle), relayout };
}
