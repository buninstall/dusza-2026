import type { Pos } from "@minescript/engine";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { playOnce, usePrefersReducedMotion } from "../lib/motion.ts";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";

const FLIGHT_MS = 1300;
const PULSE_MS = 480;
const NUGGET_PX = 32;
const POP_PX = 22;
const ARC_LIFT = 0.35;
const MIN_ARC_PX = 60;

type Point = { x: number; y: number };

type GoldFlightProps = {
  flight: { key: string; from: Pos } | null;
  rootRef: RefObject<HTMLElement | null>;
};

function centerOf(rect: DOMRect): Point {
  return {
    x: Math.round(rect.left + rect.width / 2 - NUGGET_PX / 2),
    y: Math.round(rect.top + rect.height / 2 - NUGGET_PX / 2),
  };
}

function at(point: Point, scale: number, rotate = 0): string {
  return `translate(${point.x}px, ${point.y}px) scale(${scale}) rotate(${rotate}deg)`;
}

function flightFrames(from: Point, to: Point): Keyframe[] {
  const lift = Math.max(Math.hypot(to.x - from.x, to.y - from.y) * ARC_LIFT, MIN_ARC_PX);
  const popped = { x: from.x, y: from.y - POP_PX };
  const peak = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  return [
    { transform: at(from, 0.6), opacity: 0, offset: 0 },
    { transform: at(popped, 1.5, -12), opacity: 1, offset: 0.18, easing: "ease-in-out" },
    { transform: at(peak, 1.15, 20), opacity: 1, offset: 0.55, easing: "ease-in" },
    { transform: at(to, 0.7, 0), opacity: 1, offset: 0.96 },
    { transform: at(to, 0.4, 0), opacity: 0, offset: 1 },
  ];
}

const PULSE: Keyframe[] = [
  { transform: "scale(1) rotate(0deg)" },
  { transform: "scale(1.35) rotate(-6deg)", offset: 0.35 },
  { transform: "scale(0.92) rotate(3deg)", offset: 0.7 },
  { transform: "scale(1) rotate(0deg)" },
];

function pulse(target: Element): () => void {
  return playOnce(target, PULSE, { duration: PULSE_MS, easing: "ease-out" });
}

export function GoldFlight({ flight, rootRef }: GoldFlightProps) {
  const nuggetRef = useRef<HTMLDivElement>(null);
  const isReduced = usePrefersReducedMotion();
  const key = flight?.key ?? null;
  const row = flight?.from.row ?? null;
  const col = flight?.from.col ?? null;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const nugget = nuggetRef.current;
    if (key === null || row === null || col === null || isReduced || !root || !nugget) {
      return;
    }
    const cell = root.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const target = root.querySelector("[data-gold-target] .hud-cart-art");
    const from = cell?.getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    if (!from || !to || !target || to.width === 0 || from.width === 0) {
      return;
    }
    const stopFlight = playOnce(nugget, flightFrames(centerOf(from), centerOf(to)), {
      duration: FLIGHT_MS,
    });
    let stopPulse: () => void = () => undefined;
    const timer = window.setTimeout(() => {
      stopPulse = pulse(target);
    }, FLIGHT_MS * 0.94);
    return () => {
      window.clearTimeout(timer);
      stopFlight();
      stopPulse();
    };
  }, [key, row, col, isReduced, rootRef]);

  return (
    <div ref={nuggetRef} aria-hidden="true" className="gold-flight">
      <PixelSprite sprite={TILE_SPRITES.nugget} />
    </div>
  );
}
