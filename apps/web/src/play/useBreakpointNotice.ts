import { useEffect } from "react";
import { toast } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import { usePlayback } from "./playback-store.ts";

export function useBreakpointNotice(): void {
  useEffect(
    () =>
      usePlayback.subscribe((state, previous) => {
        if (state.breakHit && state.breakHit !== previous.breakHit) {
          toast.info(hu.breakpoints.hit(state.breakHit.line));
        }
      }),
    [],
  );
}
