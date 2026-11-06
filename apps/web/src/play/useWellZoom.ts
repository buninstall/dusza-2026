import type { Pos } from "@minescript/engine";
import { type RefObject, useEffect } from "react";
import { usePlayUi } from "./play-ui-store.ts";

export function useWellZoom(wellRef: RefObject<HTMLElement | null>, robot: Pos): void {
  const zoom = usePlayUi((state) => state.zoom);
  const shiftZoom = usePlayUi((state) => state.shiftZoom);

  useEffect(() => {
    const well = wellRef.current;
    if (!well) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      shiftZoom(event.deltaY < 0 ? 1 : -1);
    };
    well.addEventListener("wheel", onWheel, { passive: false });
    return () => well.removeEventListener("wheel", onWheel);
  }, [wellRef, shiftZoom]);

  useEffect(() => {
    if (zoom <= 1) {
      return;
    }
    wellRef.current
      ?.querySelector(`[data-row="${robot.row}"][data-col="${robot.col}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [wellRef, zoom, robot.row, robot.col]);
}
