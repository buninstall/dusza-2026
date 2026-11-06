import type { RobotState, RunResult } from "@minescript/engine";
import { create } from "zustand";
import { clampIndex } from "./derive.ts";

export type PlaybackStatus = "idle" | "playing" | "paused" | "finished" | "stopped";

export const SPEED_MIN = 1;
export const SPEED_MAX = 30;
export const SPEED_DEFAULT = 4;

type PlaybackData = {
  result: RunResult | null;
  start: RobotState | null;
  index: number;
  status: PlaybackStatus;
  speed: number;
  breakpoints: ReadonlySet<number>;
};

type PlaybackActions = {
  load: (result: RunResult, start: RobotState) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  step: () => void;
  back: () => void;
  seek: (index: number) => void;
  reset: () => void;
  tick: () => void;
  setSpeed: (speed: number) => void;
  toggleBreakpoint: (line: number) => void;
  clear: () => void;
};

export type PlaybackState = PlaybackData & PlaybackActions;

const initialData: PlaybackData = {
  result: null,
  start: null,
  index: 0,
  status: "idle",
  speed: SPEED_DEFAULT,
  breakpoints: new Set(),
};

function statusAfterMove(result: RunResult, index: number): PlaybackStatus {
  return index >= result.events.length ? "finished" : "paused";
}

export const usePlayback = create<PlaybackState>()((set, get) => ({
  ...initialData,
  load: (result, start) => set({ result, start, index: 0, status: "playing" }),
  play: () => {
    const { result, index } = get();
    if (!result) {
      return;
    }
    set({ status: "playing", index: index >= result.events.length ? 0 : index });
  },
  pause: () => {
    if (get().status === "playing") {
      set({ status: "paused" });
    }
  },
  stop: () => {
    if (get().result) {
      set({ status: "stopped" });
    }
  },
  step: () => {
    const { result, index } = get();
    if (!result) {
      return;
    }
    const next = clampIndex(result, index + 1);
    set({ index: next, status: statusAfterMove(result, next) });
  },
  back: () => {
    const { result, index } = get();
    if (!result) {
      return;
    }
    set({ index: clampIndex(result, index - 1), status: "paused" });
  },
  seek: (target) => {
    const { result } = get();
    if (!result) {
      return;
    }
    const next = clampIndex(result, target);
    set({ index: next, status: statusAfterMove(result, next) });
  },
  reset: () => {
    if (get().result) {
      set({ index: 0, status: "paused" });
    }
  },
  tick: () => {
    const { result, index, status, breakpoints } = get();
    if (!result || status !== "playing") {
      return;
    }
    if (index >= result.events.length) {
      set({ status: "finished" });
      return;
    }
    const next = index + 1;
    const nextEvent = result.events[next];
    const hitsBreakpoint = nextEvent !== undefined && breakpoints.has(nextEvent.line);
    set({
      index: next,
      status: next >= result.events.length ? "finished" : hitsBreakpoint ? "paused" : "playing",
    });
  },
  setSpeed: (speed) => set({ speed: Math.min(Math.max(speed, SPEED_MIN), SPEED_MAX) }),
  toggleBreakpoint: (line) => {
    const next = new Set(get().breakpoints);
    if (next.has(line)) {
      next.delete(line);
    } else {
      next.add(line);
    }
    set({ breakpoints: next });
  },
  clear: () => set({ result: null, start: null, index: 0, status: "idle" }),
}));
