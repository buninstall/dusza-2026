import { useState } from "react";
import { tickInterval } from "./usePlaybackTimer.ts";

export const STEP_ANIMATION_MS = 220;
const ANIMATION_SHARE = 0.85;

export function stepDuration(previous: number, index: number, speed: number): number {
  if (index !== previous + 1) {
    return 0;
  }
  return Math.round(Math.min(STEP_ANIMATION_MS, tickInterval(speed) * ANIMATION_SHARE));
}

export function usePrevious<T>(value: T): T {
  const [memory, setMemory] = useState({ current: value, previous: value });
  if (!Object.is(memory.current, value)) {
    setMemory({ current: value, previous: memory.current });
    return memory.current;
  }
  return memory.previous;
}
