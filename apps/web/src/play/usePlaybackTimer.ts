import { useEffect } from "react";
import { usePlayback } from "./playback-store.ts";
import { eventBeats } from "./step-animation.ts";
import { tickInterval } from "./tick-interval.ts";

export { tickInterval };

export function usePlaybackTimer(): void {
  const status = usePlayback((state) => state.status);
  const speed = usePlayback((state) => state.speed);
  const tick = usePlayback((state) => state.tick);
  const index = usePlayback((state) => state.index);
  const result = usePlayback((state) => state.result);
  useEffect(() => {
    if (status !== "playing") {
      return;
    }
    const shown = index > 0 ? result?.events[index - 1] : undefined;
    const timer = window.setTimeout(tick, tickInterval(speed) * eventBeats(shown));
    return () => window.clearTimeout(timer);
  }, [status, speed, tick, index, result]);
}
