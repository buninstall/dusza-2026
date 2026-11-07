import type { Event } from "@minescript/engine";
import { useEffect, useState } from "react";
import { tickInterval } from "./tick-interval.ts";

export const STEP_ANIMATION_MS = 360;
const ANIMATION_SHARE = 0.9;
const TURBO_TICK_MS = 60;
const MIN_SEGMENT_MS = 40;
const MAX_BEATS = 8;
const SETTLE_TAIL_MS = 250;
export const STEP_SETTLE_MS = 700;

export function eventBeats(event: Event | null | undefined): number {
  const tiles = event?.path.length ?? 0;
  return Math.min(Math.max(tiles, 1), MAX_BEATS);
}

export function stepDuration(previous: number, index: number, speed: number, beats = 1): number {
  if (index !== previous + 1) {
    return 0;
  }
  const budget = tickInterval(speed) * beats * ANIMATION_SHARE;
  return Math.round(Math.min(STEP_ANIMATION_MS * beats, budget));
}

export function settleWindow(stepMs: number): number {
  return Math.max(STEP_SETTLE_MS, stepMs + SETTLE_TAIL_MS);
}

export function segmentDuration(pathLength: number, stepMs: number): number {
  if (pathLength <= 0 || stepMs <= 0) {
    return 0;
  }
  return Math.max(MIN_SEGMENT_MS, Math.round(stepMs / pathLength));
}

export function isTurbo(speed: number): boolean {
  return tickInterval(speed) < TURBO_TICK_MS;
}

export function usePrevious<T>(value: T): T {
  const [memory, setMemory] = useState({ current: value, previous: value });
  if (!Object.is(memory.current, value)) {
    setMemory({ current: value, previous: memory.current });
    return memory.current;
  }
  return memory.previous;
}

export function useStepWindow(key: string, isActive: boolean, windowMs = STEP_SETTLE_MS): boolean {
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const timer = window.setTimeout(() => setSettled(key), windowMs);
    return () => window.clearTimeout(timer);
  }, [key, isActive, windowMs]);
  return isActive && settled !== key;
}
