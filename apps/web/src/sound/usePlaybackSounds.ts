import type { Event, RunResult } from "@minescript/engine";
import { useEffect } from "react";
import { usePlayback } from "../play/playback-store.ts";
import { type Cue, playCue } from "./sfx.ts";

function cueFor(event: Event, previous: Event | undefined): Cue | null {
  if (event.mined) {
    return "mine";
  }
  if (event.path.length > 0) {
    return "step";
  }
  const before = previous?.robot.dir;
  if (before !== undefined && before !== event.robot.dir) {
    return "turn";
  }
  if (event.print !== null) {
    return "print";
  }
  return event.discovered.length > 0 ? "scan" : null;
}

function endCue(result: RunResult): Cue {
  return result.outcome.kind === "ok" ? "finish" : "error";
}

export function usePlaybackSounds(): void {
  useEffect(
    () =>
      usePlayback.subscribe((state, previous) => {
        const { result, index, status } = state;
        if (!result || state.runId !== previous.runId || index !== previous.index + 1) {
          return;
        }
        const event = result.events[index - 1];
        const cue = event ? cueFor(event, result.events[index - 2]) : null;
        const isEnd = status === "finished" && index === result.events.length;
        if (cue && !(isEnd && result.outcome.kind !== "ok")) {
          playCue(cue);
        }
        if (isEnd) {
          playCue(endCue(result));
        }
      }),
    [],
  );
}
