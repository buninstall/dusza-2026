import type { MineMap, RobotState } from "@minescript/engine";
import { useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "../lib/storage.ts";
import {
  decodeSketch,
  EMPTY_SKETCH,
  encodeSketch,
  isDarkMine,
  type LampMode,
  lampTrack,
  type Sketch,
  sketchAfterRun,
  sketchKey,
} from "./lamp-mode.ts";
import { usePlayback } from "./playback-store.ts";

type LampSketchInput = {
  userId: number | null;
  mapVersionId: number;
  mode: LampMode;
  map: MineMap;
  start: RobotState;
};

function load(key: string | null): Sketch {
  return key === null ? EMPTY_SKETCH : decodeSketch(readStorage(key));
}

export function useLampSketch({ userId, mapVersionId, mode, map, start }: LampSketchInput): Sketch {
  const key = userId === null || !isDarkMine(mode) ? null : sketchKey(userId, mapVersionId);
  const [state, setState] = useState(() => ({ key, sketch: load(key) }));
  const appliedRun = useRef<number | null>(null);
  const current = state.key === key ? state.sketch : load(key);

  useEffect(() => {
    if (key === null) {
      return undefined;
    }
    return usePlayback.subscribe((playback) => {
      const { result, hasEnded, runId } = playback;
      if (!hasEnded || result === null || appliedRun.current === runId) {
        return;
      }
      appliedRun.current = runId;
      setState((previous) => {
        const base = previous.key === key ? previous.sketch : load(key);
        const next = sketchAfterRun(base, start, result, lampTrack(map, start, result, mode));
        writeStorage(key, encodeSketch(next));
        return { key, sketch: next };
      });
    });
  }, [key, map, start, mode]);

  return current;
}
