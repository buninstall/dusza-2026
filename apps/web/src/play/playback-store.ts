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
  source: string;
  runId: number;
  index: number;
  status: PlaybackStatus;
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
  tick: () => void;
  setSpeed: (speed: number) => void;
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
  speed: SPEED_DEFAULT,
};

function isActive(status: PlaybackStatus): boolean {
  return status === "playing" || status === "paused";
}

function statusAt(result: RunResult, index: number): PlaybackStatus {
  return index >= result.events.length ? "finished" : "paused";
}

export const usePlayback = create<PlaybackState>()((set, get) => {
  const moveTo = (target: number) => {
    const { result, status } = get();
    if (!result || !isActive(status)) {
      return;
    }
    const index = clampIndex(result, target);
    set({ index, status: statusAt(result, index) });
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
      if (isActive(get().status)) {
        set({ status: "stopped" });
      }
    },
    step: () => moveTo(get().index + 1),
    back: () => moveTo(get().index - 1),
    seek: (target) => moveTo(target),
    restart: () => moveTo(0),
    tick: () => {
      const { result, index, status } = get();
      if (!result || status !== "playing") {
        return;
      }
      const next = clampIndex(result, index + 1);
      set({ index: next, status: next >= result.events.length ? "finished" : "playing" });
    },
    setSpeed: (speed) =>
      set({ speed: Math.min(Math.max(Math.round(speed), SPEED_MIN), SPEED_MAX) }),
    clear: () => set((state) => ({ ...initialData, speed: state.speed, runId: state.runId })),
  };
});

export function isPlaybackActive(status: PlaybackStatus): boolean {
  return isActive(status);
}
