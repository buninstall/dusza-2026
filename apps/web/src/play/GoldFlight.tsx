import type { Pos } from "@minescript/engine";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
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

function clampTo(rect: Box, frame: Box): Box {
  const half = NUGGET_PX / 2;
  const x = Math.min(Math.max((rect.left + rect.right) / 2, frame.left + half), frame.right - half);
  const y = Math.min(Math.max((rect.top + rect.bottom) / 2, frame.top + half), frame.bottom - half);
  return { left: x, right: x, top: y, bottom: y };
}

function cartBox(cart: Element): Box | null {
  const shown = visibleBox(cart);
  if (shown) {
    return shown;
  }
  const scene = cart.closest(".mine-scene");
  const frame = scene ? visibleBox(scene) : null;
  return frame ? clampTo(cart.getBoundingClientRect(), frame) : null;
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

function launch(
  template: HTMLElement | null,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
  live: Set<() => void>,
): void {
  if (!template || typeof template.animate !== "function") {
    return;
  }
  const clone = template.cloneNode(true) as HTMLElement;
  template.after(clone);
  const animation = clone.animate(frames, options);
  const stop = () => {
    animation.cancel();
    clone.remove();
    live.delete(stop);
  };
  live.add(stop);
  animation.finished.then(stop, stop);
}

export function GoldFlight({ flight, rootRef }: GoldFlightProps) {
  const nuggetRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const live = useRef(new Set<() => void>());
  const isReduced = usePrefersReducedMotion();
  const key = flight?.key ?? null;
  const row = flight?.from.row ?? null;
  const col = flight?.from.col ?? null;

  useEffect(() => {
    const running = live.current;
    return () => {
      for (const stop of [...running]) {
        stop();
      }
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (key === null || row === null || col === null || isReduced || !root) {
      return;
    }
    const cell = root.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const scene = root.querySelector("[data-scene-cart]");
    const hud = scene ? null : root.querySelector("[data-gold-target] .hud-cart-art");
    const from = cell ? visibleBox(cell) : null;
    const to = scene ? cartBox(scene) : hud ? visibleBox(hud) : null;
    if (!from || !to) {
      return;
    }
    const cart = centerOf(to);
    launch(
      nuggetRef.current,
      flightFrames(centerOf(from), cart),
      { duration: FLIGHT_MS },
      live.current,
    );
    window.setTimeout(() => {
      if (hud) {
        playOnce(hud, PULSE, { duration: PULSE_MS, easing: "ease-out" });
      }
      launch(
        plusRef.current,
        plusFrames(cart),
        { duration: PLUS_MS, easing: "ease-out" },
        live.current,
      );
    }, FLIGHT_MS * DROP_AT);
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
