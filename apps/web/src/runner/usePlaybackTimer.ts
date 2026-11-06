import { useEffect } from "react";
import { usePlayback } from "./playback-store.ts";

export function usePlaybackTimer(): void {
  const status = usePlayback((state) => state.status);
  const speed = usePlayback((state) => state.speed);
  const tick = usePlayback((state) => state.tick);
  useEffect(() => {
    if (status !== "playing") {
      return;
    }
    const timer = window.setInterval(tick, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [status, speed, tick]);
}
