import type { Dir } from "@minescript/engine";
import { useState } from "react";

const CLOCKWISE_INDEX: Record<Dir, number> = { north: 0, east: 1, south: 2, west: 3 };

const QUARTERS = 4;
const HALF_TURN = 2;

export function quarterIndex(dir: Dir): number {
  return CLOCKWISE_INDEX[dir];
}

export function nextQuarterTurns(previous: number, dir: Dir): number {
  const current = ((previous % QUARTERS) + QUARTERS) % QUARTERS;
  let delta = CLOCKWISE_INDEX[dir] - current;
  if (delta >= HALF_TURN) {
    delta -= QUARTERS;
  } else if (delta < -HALF_TURN) {
    delta += QUARTERS;
  }
  return previous + delta;
}

export function useQuarterTurns(dir: Dir): number {
  const [state, setState] = useState(() => ({ dir, turns: quarterIndex(dir) }));
  if (state.dir !== dir) {
    const next = { dir, turns: nextQuarterTurns(state.turns, dir) };
    setState(next);
    return next.turns;
  }
  return state.turns;
}
