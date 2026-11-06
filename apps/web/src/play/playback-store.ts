import type { RobotState, RunResult } from "@minescript/engine";
import { create } from "zustand";
import { clampIndex } from "./derive.ts";

export type PlaybackStatus = "idle" | "playing" | "paused" | "finished" | "stopped";

export const SPEED_STEPS = [1, 2, 4, 8, 15, 30] as const;
export const SPEED_DEFAULT = 4;
export const SPEED_MIN = SPEED_STEPS[0];
export const SPEED_MAX = SPEED_STEPS[SPEED_STEPS.length - 1] ?? SPEED_DEFAULT;

type PlaybackData = {
  result: RunResult | null;
  start: RobotState | null;
  source: string;
  runId: number;
  index: number;
  status: PlaybackStatus;
  hasEnded: boolean;
  speed: number;
};

type PlaybackActions = {
  load: (result: RunResult, start: RobotState, source: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  step: () => void;
  back: () => void;
  seek: (index: number) => void;
  restart: () => void;
  replay: () => void;
  tick: () => void;
  setSpeed: (speed: number) => void;
  shiftSpeed: (delta: number) => void;
  clear: () => void;
};

export type PlaybackState = PlaybackData & PlaybackActions;

const initialData: PlaybackData = {
  result: null,
  start: null,
  source: "",
  runId: 0,
  index: 0,
  status: "idle",
  hasEnded: false,
  speed: SPEED_DEFAULT,
};

export function isPlaybackActive(status: PlaybackStatus): boolean {
  return status === "playing" || status === "paused";
}

export function isScrubbable(status: PlaybackStatus): boolean {
  return isPlaybackActive(status) || status === "finished";
}

export function isLiveRun(status: PlaybackStatus, hasEnded: boolean): boolean {
  return isPlaybackActive(status) && !hasEnded;
}

export function speedIndex(speed: number): number {
  const exact = SPEED_STEPS.findIndex((step) => step >= speed);
  return exact === -1 ? SPEED_STEPS.length - 1 : exact;
}

export function speedAt(index: number): number {
  const safe = Math.min(Math.max(Math.round(index), 0), SPEED_STEPS.length - 1);
  return SPEED_STEPS[safe] ?? SPEED_DEFAULT;
}

export const usePlayback = create<PlaybackState>()((set, get) => {
  const moveTo = (target: number) => {
    const { result, status, hasEnded } = get();
    if (!result || !isScrubbable(status)) {
      return;
    }
    const index = clampIndex(result, target);
    const atEnd = index >= result.events.length;
    set({ index, status: atEnd ? "finished" : "paused", hasEnded: hasEnded || atEnd });
  };

  return {
    ...initialData,
    load: (result, start, source) =>
      set((state) => ({
        result,
        start,
        source,
        runId: state.runId + 1,
        index: 0,
        status: "playing",
        hasEnded: false,
      })),
    play: () => {
      if (get().status === "paused") {
        set({ status: "playing" });
      }
    },
    pause: () => {
      if (get().status === "playing") {
        set({ status: "paused" });
      }
    },
    stop: () => {
      const { status, hasEnded } = get();
      if (isLiveRun(status, hasEnded)) {
        set({ status: "stopped" });
      }
    },
    step: () => moveTo(get().index + 1),
    back: () => moveTo(get().index - 1),
    seek: (target) => moveTo(target),
    restart: () => moveTo(0),
    replay: () => {
      const { result, status } = get();
      if (result && isScrubbable(status)) {
        set({ index: 0, status: "playing" });
      }
    },
    tick: () => {
      const { result, index, status } = get();
      if (!result || status !== "playing") {
        return;
      }
      const next = clampIndex(result, index + 1);
      const atEnd = next >= result.events.length;
      set(atEnd ? { index: next, status: "finished", hasEnded: true } : { index: next });
    },
    setSpeed: (speed) => set({ speed: speedAt(speedIndex(speed)) }),
    shiftSpeed: (delta) => set({ speed: speedAt(speedIndex(get().speed) + delta) }),
    clear: () => set((state) => ({ ...initialData, speed: state.speed, runId: state.runId })),
  };
});
