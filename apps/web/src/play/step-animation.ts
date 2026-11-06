import { useEffect, useState } from "react";
import { tickInterval } from "./usePlaybackTimer.ts";

export const STEP_ANIMATION_MS = 220;
const ANIMATION_SHARE = 0.85;
const TURBO_TICK_MS = 60;
const MIN_SEGMENT_MS = 40;
export const STEP_SETTLE_MS = 700;

export function stepDuration(previous: number, index: number, speed: number): number {
  if (index !== previous + 1) {
    return 0;
  }
  return Math.round(Math.min(STEP_ANIMATION_MS, tickInterval(speed) * ANIMATION_SHARE));
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

export function useStepWindow(key: string, isActive: boolean): boolean {
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const timer = window.setTimeout(() => setSettled(key), STEP_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [key, isActive]);
  return isActive && settled !== key;
}
