import { useEffect } from "react";
import { usePlayback } from "./playback-store.ts";

const MS_PER_SECOND = 1000;

export function tickInterval(speed: number): number {
  return MS_PER_SECOND / speed;
}

export function usePlaybackTimer(): void {
  const status = usePlayback((state) => state.status);
  const speed = usePlayback((state) => state.speed);
  const tick = usePlayback((state) => state.tick);
  useEffect(() => {
    if (status !== "playing") {
      return;
    }
    const timer = window.setInterval(tick, tickInterval(speed));
    return () => window.clearInterval(timer);
  }, [status, speed, tick]);
}
