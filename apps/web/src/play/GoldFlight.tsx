import type { Pos } from "@minescript/engine";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { playOnce, usePrefersReducedMotion } from "../lib/motion.ts";
import { PixelText } from "../pixel/PixelText.tsx";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";

export const FLIGHT_MS = 1300;
const PULSE_MS = 480;
const PLUS_MS = 700;
const NUGGET_PX = 32;
const POP_PX = 18;
const HOVER_PX = 14;
const SINK_PX = 4;
const POP_END = 0.16;
const GLIDE_END = 0.82;
const DROP_AT = 0.9;
const GLIDE_SAMPLES = 10;

export type Point = { x: number; y: number };

type Box = { left: number; top: number; right: number; bottom: number };

type GoldFlightProps = {
  flight: { key: string; from: Pos } | null;
  rootRef: RefObject<HTMLElement | null>;
};

function clip(box: Box, by: Box): Box | null {
  const next = {
    left: Math.max(box.left, by.left),
    top: Math.max(box.top, by.top),
    right: Math.min(box.right, by.right),
    bottom: Math.min(box.bottom, by.bottom),
  };
  return next.right - next.left > 1 && next.bottom - next.top > 1 ? next : null;
}

function isClipping(overflow: string): boolean {
  return overflow !== "" && overflow !== "visible";
}

function visibleBox(element: Element): Box | null {
  let box: Box | null = clip(element.getBoundingClientRect(), {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  });
  for (
    let parent = element.parentElement;
    parent && box && parent !== document.body;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    if ([style.overflow, style.overflowX, style.overflowY].some(isClipping)) {
      box = clip(box, parent.getBoundingClientRect());
    }
  }
  return box;
}

function centerOf(rect: Box): Point {
  return {
    x: Math.round((rect.left + rect.right) / 2 - NUGGET_PX / 2),
    y: Math.round((rect.top + rect.bottom) / 2 - NUGGET_PX / 2),
  };
}

function at(point: Point, scale: number, rotate = 0): string {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  return `translate(${x}px, ${y}px) scale(${scale.toFixed(2)}) rotate(${Math.round(rotate)}deg)`;
}

function bezier(a: Point, control: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function flightFrames(from: Point, to: Point): Keyframe[] {
  const popped = { x: from.x, y: from.y - POP_PX };
  const hover = { x: to.x, y: to.y - HOVER_PX };
  const control = { x: to.x, y: Math.max(popped.y, hover.y) };
  const glide = Array.from({ length: GLIDE_SAMPLES }, (_, index) => {
    const t = (index + 1) / GLIDE_SAMPLES;
    return {
      transform: at(
        bezier(popped, control, hover, easeInOut(t)),
        1.3 - 0.3 * t,
        18 * Math.sin(t * Math.PI),
      ),
      opacity: 1,
      offset: POP_END + (GLIDE_END - POP_END) * t,
    };
  });
  const sunk = { x: to.x, y: to.y + SINK_PX };
  return [
    { transform: at(from, 0.5), opacity: 0, offset: 0 },
    { transform: at(popped, 1.4, -10), opacity: 1, offset: POP_END, easing: "ease-out" },
    ...glide,
    { transform: at(sunk, 0.75), opacity: 1, offset: DROP_AT, easing: "ease-in" },
    { transform: at(sunk, 0.4), opacity: 0, offset: 1 },
  ];
}

const PULSE: Keyframe[] = [
  { transform: "translateY(0) rotate(0deg)" },
  { transform: "translateY(3px) rotate(-5deg)", offset: 0.3 },
  { transform: "translateY(-2px) rotate(3deg)", offset: 0.65 },
  { transform: "translateY(0) rotate(0deg)" },
];

function plusFrames(cart: Point): Keyframe[] {
  return [
    { transform: `translate(${cart.x}px, ${cart.y}px)`, opacity: 0 },
    { transform: `translate(${cart.x}px, ${cart.y - 10}px)`, opacity: 1, offset: 0.25 },
    { transform: `translate(${cart.x}px, ${cart.y - 22}px)`, opacity: 0 },
  ];
}

export function GoldFlight({ flight, rootRef }: GoldFlightProps) {
  const nuggetRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
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
    const from = cell ? visibleBox(cell) : null;
    const to = target ? visibleBox(target) : null;
    if (!from || !to || !target) {
      return;
    }
    const cart = centerOf(to);
    const stops = [playOnce(nugget, flightFrames(centerOf(from), cart), { duration: FLIGHT_MS })];
    const timer = window.setTimeout(() => {
      stops.push(playOnce(target, PULSE, { duration: PULSE_MS, easing: "ease-out" }));
      stops.push(
        playOnce(plusRef.current, plusFrames(cart), { duration: PLUS_MS, easing: "ease-out" }),
      );
    }, FLIGHT_MS * DROP_AT);
    return () => {
      window.clearTimeout(timer);
      for (const stop of stops) {
        stop();
      }
    };
  }, [key, row, col, isReduced, rootRef]);

  return (
    <>
      <div ref={nuggetRef} aria-hidden="true" className="gold-flight">
        <PixelSprite sprite={TILE_SPRITES.nugget} />
      </div>
      <div ref={plusRef} aria-hidden="true" className="gold-plus">
        <PixelText text="+1" scale={2} />
      </div>
    </>
  );
}
