import type { Pos } from "@minescript/engine";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";

export type MotionKind = "walk" | "mine" | "settle" | "shake" | "bump" | "still";

type Ease = (t: number) => number;
type Pose = { at: number; x?: number; y?: number; sx?: number; sy?: number };
type Spec = { unit: "art" | "tile"; minMs: number; fixedMs?: number; ease: Ease; poses: Pose[] };
type Point = { x: number; y: number };

const ART_PER_TILE = 16;
const SAMPLE_MS = 4;
const BISECT_STEPS = 24;
const HOLD = "steps(1, end)";
const DRILL_SCALE = 0.97;

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const curve = (a: number, b: number, t: number) =>
    3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  return (x) => {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < BISECT_STEPS; i += 1) {
      const mid = (lo + hi) / 2;
      if (curve(x1, x2, mid) < x) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return curve(y1, y2, (lo + hi) / 2);
  };
}

const LINEAR: Ease = (t) => t;
const DRIVE = cubicBezier(0.5, 0, 0.3, 1);
const SETTLE = cubicBezier(0.3, 0, 0.3, 1);

const DRILL_SWAY: Pose[] = [0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76].map((at, index) => ({
  at,
  x: index % 2 === 0 ? 0.5 : -0.5,
  y: -1,
  sx: DRILL_SCALE,
  sy: DRILL_SCALE,
}));

const SPECS: Partial<Record<MotionKind, Spec>> = {
  walk: {
    unit: "art",
    minMs: 200,
    ease: LINEAR,
    poses: [
      { at: 0 },
      { at: 0.12, y: 0.75 },
      { at: 0.28 },
      { at: 0.8 },
      { at: 0.91, y: -1 },
      { at: 1 },
    ],
  },
  mine: {
    unit: "art",
    minMs: 320,
    ease: LINEAR,
    poses: [
      { at: 0 },
      { at: 0.12, y: -1, sx: DRILL_SCALE, sy: DRILL_SCALE },
      ...DRILL_SWAY,
      { at: 0.86, y: 0.5 },
      { at: 1 },
    ],
  },
  settle: {
    unit: "art",
    minMs: 0,
    fixedMs: 520,
    ease: SETTLE,
    poses: [
      { at: 0 },
      { at: 0.3, sx: 1.04, sy: 0.94 },
      { at: 0.62, sx: 0.99, sy: 1.02 },
      { at: 1 },
    ],
  },
  shake: {
    unit: "art",
    minMs: 0,
    fixedMs: 420,
    ease: LINEAR,
    poses: [
      { at: 0 },
      { at: 0.1, x: -1.5 },
      { at: 0.26, x: 1 },
      { at: 0.44, x: -0.5 },
      { at: 0.62, x: 0.25 },
      { at: 1 },
    ],
  },
  bump: {
    unit: "tile",
    minMs: 0,
    fixedMs: 460,
    ease: LINEAR,
    poses: [
      { at: 0 },
      { at: 0.16, y: -0.16 },
      { at: 0.3, y: 0.06 },
      { at: 0.48, y: -0.02 },
      { at: 0.66 },
      { at: 1 },
    ],
  },
};

function deviceRatio(): number {
  const ratio = window.devicePixelRatio || 1;
  return ratio > 0 ? ratio : 1;
}

function snap(value: number, ratio: number): number {
  return Math.round(value * ratio) / ratio;
}

function snapScale(scale: number, size: number, ratio: number): number {
  const device = size * ratio;
  return device > 0 ? Math.round(scale * device) / device : scale;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function poseAt(spec: Spec, t: number): Required<Omit<Pose, "at">> {
  const index = Math.max(
    spec.poses.findIndex((pose, i) => t <= (spec.poses[i + 1]?.at ?? 1) && t >= pose.at),
    0,
  );
  const a = spec.poses[index] ?? { at: 0 };
  const b = spec.poses[index + 1] ?? a;
  const span = b.at - a.at;
  const e = span > 0 ? spec.ease((t - a.at) / span) : 1;
  return {
    x: lerp(a.x ?? 0, b.x ?? 0, e),
    y: lerp(a.y ?? 0, b.y ?? 0, e),
    sx: lerp(a.sx ?? 1, b.sx ?? 1, e),
    sy: lerp(a.sy ?? 1, b.sy ?? 1, e),
  };
}

function sampled(duration: number, frameAt: (t: number) => Keyframe): Keyframe[] {
  const steps = Math.max(1, Math.ceil(duration / SAMPLE_MS));
  const frames: Keyframe[] = [];
  let last = "";
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const frame = frameAt(t);
    const key = `${frame.translate ?? ""}|${frame.scale ?? ""}|${frame.transform ?? ""}`;
    if (key !== last || i === steps) {
      frames.push({ ...frame, offset: t, easing: HOLD });
      last = key;
    }
  }
  return frames;
}

export function motionFrames(
  kind: MotionKind,
  tile: number,
  ratio: number,
  duration: number,
): Keyframe[] {
  const spec = SPECS[kind];
  if (!spec) {
    return [];
  }
  const unit = spec.unit === "tile" ? tile : tile / ART_PER_TILE;
  return sampled(duration, (t) => {
    const pose = poseAt(spec, t);
    return {
      translate: `${snap(pose.x * unit, ratio)}px ${snap(pose.y * unit, ratio)}px`,
      scale: `${snapScale(pose.sx, tile, ratio)} ${snapScale(pose.sy, tile, ratio)}`,
    };
  });
}

export function moveFrames(from: Point, to: Point, ratio: number, duration: number): Keyframe[] {
  return sampled(duration, (t) => {
    const e = DRIVE(t);
    const x = snap(lerp(from.x, to.x, e), ratio);
    const y = snap(lerp(from.y, to.y, e), ratio);
    return { transform: `translate(${x}px, ${y}px)` };
  });
}

export function motionMs(kind: MotionKind, stepMs: number): number {
  const spec = SPECS[kind];
  return spec ? (spec.fixedMs ?? Math.max(spec.minMs, stepMs)) : 0;
}

function tileOf(element: Element): number {
  const width = Number.parseFloat(getComputedStyle(element).width);
  return Number.isFinite(width) ? width : 0;
}

function shownOffset(element: Element): Point {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
  return { x: matrix.m41, y: matrix.m42 };
}

type SnappedRobot = {
  isOn: boolean;
  robotRef: RefObject<HTMLDivElement | null>;
  pos: Pos;
  kind: MotionKind;
  stepMs: number;
};

type Drive = { from: Point; to: Point; duration: number; animation: Animation };

function retime(animation: Animation, next: Animation): void {
  const elapsed = animation.currentTime;
  animation.cancel();
  if (typeof elapsed === "number") {
    next.currentTime = elapsed;
  }
}

export function useSnappedRobot({ isOn, robotRef, pos, kind, stepMs }: SnappedRobot) {
  const isReduced = usePrefersReducedMotion();
  const placed = useRef<Pos | null>(null);
  const drive = useRef<Drive | null>(null);
  const pose = useRef<{ element: HTMLDivElement; duration: number; animation: Animation } | null>(
    null,
  );
  const { row, col } = pos;
  const isActive = isOn && !isReduced;

  useLayoutEffect(() => {
    const element = robotRef.current;
    const before = placed.current;
    placed.current = { row, col };
    if (!isActive || !element || !before || stepMs <= 0) {
      return;
    }
    if ((before.row === row && before.col === col) || typeof element.animate !== "function") {
      return;
    }
    const tile = tileOf(element);
    const current = drive.current;
    const isRunning = current?.animation.playState === "running" && tile > 0;
    const shown = isRunning ? shownOffset(element) : null;
    const from = shown
      ? { x: shown.x / tile, y: shown.y / tile }
      : { x: before.col, y: before.row };
    const to = { x: col, y: row };
    current?.animation.cancel();
    const animation = element.animate(
      moveFrames(
        { x: from.x * tile, y: from.y * tile },
        { x: to.x * tile, y: to.y * tile },
        deviceRatio(),
        stepMs,
      ),
      { duration: stepMs },
    );
    animation.finished.catch(() => undefined);
    drive.current = { from, to, duration: stepMs, animation };
  }, [isActive, row, col, stepMs, robotRef]);

  useLayoutEffect(() => {
    const element = robotRef.current;
    if (!isActive || !element || typeof ResizeObserver === "undefined") {
      return;
    }
    let lastTile = tileOf(element);
    const observer = new ResizeObserver(() => {
      const tile = tileOf(element);
      if (tile <= 0 || tile === lastTile) {
        return;
      }
      lastTile = tile;
      const current = drive.current;
      if (current && current.animation.playState === "running") {
        const next = element.animate(
          moveFrames(
            { x: current.from.x * tile, y: current.from.y * tile },
            { x: current.to.x * tile, y: current.to.y * tile },
            deviceRatio(),
            current.duration,
          ),
          { duration: current.duration },
        );
        next.finished.catch(() => undefined);
        retime(current.animation, next);
        drive.current = { ...current, animation: next };
      }
      const shownPose = pose.current;
      if (shownPose && shownPose.animation.playState === "running") {
        const next = shownPose.element.animate(
          motionFrames(kind, tile, deviceRatio(), shownPose.duration),
          { duration: shownPose.duration },
        );
        next.finished.catch(() => undefined);
        retime(shownPose.animation, next);
        pose.current = { ...shownPose, animation: next };
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isActive, kind, robotRef]);

  return useCallback(
    (element: HTMLDivElement | null) => {
      const duration = motionMs(kind, stepMs);
      if (!isActive || !element || duration <= 0 || typeof element.animate !== "function") {
        return;
      }
      const animation = element.animate(
        motionFrames(kind, tileOf(element), deviceRatio(), duration),
        { duration },
      );
      animation.finished.catch(() => undefined);
      pose.current = { element, duration, animation };
      return () => {
        pose.current?.animation.cancel();
        pose.current = null;
      };
    },
    [isActive, kind, stepMs],
  );
}
