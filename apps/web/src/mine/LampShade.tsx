import type { RobotState } from "@minescript/engine";
import { useEffect, useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { TILE_SIZE } from "../pixel/tiles.ts";
import {
  FADE_MS,
  fadeLevel,
  flicker,
  isSettled,
  type LightSpot,
  lightSpot,
  mixSpot,
  parseRgb,
  type RevealState,
  type Rgb,
  scheduleReveal,
  shadeInto,
} from "./lamp-shade.ts";
import { posKey } from "./tiles-model.ts";

const MIN_TRAVEL_MS = 260;

export type LampShadeProps = {
  rows: number;
  cols: number;
  visible: ReadonlySet<string>;
  seen: ReadonlySet<string>;
  robot: RobotState;
  radius: number;
  isBroken: boolean;
  stepMs: number;
};

type Travel = { from: LightSpot; to: LightSpot; start: number; duration: number };
type Glow = { from: number; to: number; start: number };
type Palette = { void: Rgb; ember: Rgb; glow: Rgb };

const BLACK: Rgb = [0, 0, 0];

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const voidColor = parseRgb(style.getPropertyValue("--px-void")) ?? BLACK;
  const ore = parseRgb(style.getPropertyValue("--px-ore")) ?? voidColor;
  return { void: voidColor, ember: ore, glow: ore };
}

function spotAt(travel: Travel, now: number): LightSpot {
  return mixSpot(travel.from, travel.to, (now - travel.start) / travel.duration);
}

function glowAt(glow: Glow, now: number): number {
  const t = Math.min(Math.max((now - glow.start) / FADE_MS, 0), 1);
  return glow.from + (glow.to - glow.from) * t;
}

export function LampShade(props: LampShadeProps) {
  const { rows, cols, visible, seen, robot, radius, isBroken, stepMs } = props;
  const isReduced = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reveal = useRef<RevealState>(new Map());
  const travel = useRef<Travel | null>(null);
  const glow = useRef<Glow>({ from: 0, to: 0, start: 0 });
  const palette = useRef<Palette | null>(null);
  const seenRef = useRef(seen);
  const frameRef = useRef(0);
  const drawRef = useRef<(now: number) => boolean>(() => false);

  drawRef.current = (now: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    if (!canvas || !context || !travel.current || !palette.current) {
      return false;
    }
    const image = context.createImageData(cols * TILE_SIZE, rows * TILE_SIZE);
    const state = reveal.current;
    const known = seenRef.current;
    const intensity = glowAt(glow.current, now) * (isReduced ? 1 : flicker(now));
    shadeInto(
      {
        cols,
        rows,
        level: (row, col) => fadeLevel(state.get(`${row}:${col}`), now),
        isSeen: (row, col) => known.has(`${row}:${col}`),
        spot: spotAt(travel.current, now),
        intensity,
        ...palette.current,
      },
      image.data,
    );
    context.putImageData(image, 0, 0);
    const isMoving = now < travel.current.start + travel.current.duration;
    const isFading = now < glow.current.start + FADE_MS;
    return !isReduced || isMoving || isFading || !isSettled(state, now);
  };

  const tickRef = useRef<FrameRequestCallback>(() => undefined);
  tickRef.current = (now: number) => {
    frameRef.current = drawRef.current(now) ? requestAnimationFrame(tickRef.current) : 0;
  };

  useLayoutEffect(() => {
    const now = performance.now();
    seenRef.current = seen;
    if (canvasRef.current) {
      palette.current = readPalette(canvasRef.current);
    }
    const shown = new Set(visible);
    shown.add(posKey(robot.pos));
    reveal.current = scheduleReveal(reveal.current, shown, robot.pos, now, isReduced);
    const target = lightSpot(robot.pos, robot.dir, radius);
    const current = travel.current ? spotAt(travel.current, now) : target;
    travel.current = {
      from: current,
      to: target,
      start: now,
      duration: isReduced ? 1 : Math.max(stepMs, MIN_TRAVEL_MS),
    };
    const wanted = isBroken ? 0 : 1;
    if (glow.current.start === 0 || glow.current.to !== wanted) {
      glow.current = { from: glowAt(glow.current, now), to: wanted, start: now };
    }
    if (drawRef.current(now) && frameRef.current === 0) {
      frameRef.current = requestAnimationFrame(tickRef.current);
    }
  }, [visible, seen, robot, radius, isBroken, stepMs, isReduced]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    },
    [],
  );

  return (
    <div aria-hidden="true" className="board-lamp-shade">
      <canvas ref={canvasRef} width={cols * TILE_SIZE} height={rows * TILE_SIZE} />
    </div>
  );
}
