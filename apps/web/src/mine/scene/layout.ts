export const T = 16;
export const POST_W = 12;
export const BEAM_H = 12;
export const SILL_H = 8;
export const RAIL_H = 7;
export const BEAM_OVERHANG = 5;
const MARGIN_X = 220;
const MARGIN_TOP = 150;
const MARGIN_BOTTOM = 120;
const HOOK_STEP = 74;
const LANTERN_REACH = 22;
const FRAME_PAD = 4;

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type Point = { x: number; y: number };

export type Lantern = Point & { armX0: number; armX1: number };

export type SceneLayout = {
  W: number;
  H: number;
  cols: number;
  rows: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  postL: number;
  postR: number;
  beamY: number;
  sillY: number;
  railY: number;
  groundY: number;
  cableY: number;
  hooks: readonly number[];
  bulbs: readonly (Point & { isFaulty: boolean })[];
  lanterns: readonly Lantern[];
  cart: Point;
  pilot: Point;
  floorLamp: Point;
  floods: readonly (Point & { isFlipped: boolean })[];
  frame: Box;
};

export function sceneLayout(cols: number, rows: number): SceneLayout {
  const bw = cols * T;
  const bh = rows * T;
  const bx = MARGIN_X;
  const by = MARGIN_TOP;
  const W = MARGIN_X * 2 + bw;
  const H = MARGIN_TOP + bh + MARGIN_BOTTOM;
  const postL = bx - POST_W;
  const postR = bx + bw;
  const beamY = by - BEAM_H;
  const sillY = by + bh;
  const railY = sillY + SILL_H;
  const groundY = railY + RAIL_H;
  const cableY = beamY - 22;
  const hooks: number[] = [];
  for (let x = 14; x < W; x += HOOK_STEP) {
    hooks.push(x);
  }
  const bulbs = hooks.slice(0, -1).map((x, index) => ({
    x: Math.round((x + (hooks[index + 1] ?? x)) / 2),
    y: cableY + 6,
    isFaulty: index % 5 === 3,
  }));
  return {
    W,
    H,
    cols,
    rows,
    bx,
    by,
    bw,
    bh,
    postL,
    postR,
    beamY,
    sillY,
    railY,
    groundY,
    cableY,
    hooks,
    bulbs,
    lanterns: [
      { x: postL - 17, y: by + 6, armX0: postL - 8, armX1: postL },
      { x: postR + POST_W + 6, y: by + 6, armX0: postR + POST_W, armX1: postR + POST_W + 8 },
    ],
    cart: { x: postR + POST_W + 22, y: railY - 16 },
    pilot: { x: postR + POST_W + 33, y: railY - 33 },
    floorLamp: { x: postL - 56, y: groundY - 15 },
    floods: [
      { x: postL - 4, y: beamY - 21, isFlipped: false },
      { x: postR + POST_W - 14, y: beamY - 21, isFlipped: true },
    ],
    frame: {
      x0: postL - LANTERN_REACH,
      y0: beamY - FRAME_PAD,
      x1: postR + POST_W + LANTERN_REACH,
      y1: groundY + FRAME_PAD,
    },
  };
}

export type RulerSpot = { text: string; x: number; y: number; axis: "col" | "row"; index: number };

export function rulerSpots(layout: SceneLayout): RulerSpot[] {
  const spots: RulerSpot[] = [];
  for (let c = 0; c < layout.cols; c += 1) {
    const text = String(c + 1);
    spots.push({
      text,
      axis: "col",
      index: c,
      x: Math.round(layout.bx + c * T + 8 - (text.length * 4 - 1) / 2),
      y: layout.beamY + 4,
    });
  }
  for (let r = 0; r < layout.rows; r += 1) {
    const text = String(r + 1);
    spots.push({
      text,
      axis: "row",
      index: r,
      x: Math.round(layout.postL + 6 - (text.length * 4 - 1) / 2),
      y: layout.by + r * T + 6,
    });
  }
  return spots;
}

export const DIGITS: Readonly<Record<string, readonly string[]>> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
};
