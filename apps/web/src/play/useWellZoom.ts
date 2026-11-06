import type { Pos } from "@minescript/engine";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { usePlayUi } from "./play-ui-store.ts";

const LINE_PX = 16;
const PINCH_CAP = 25;
const PINCH_SCALE = 100;
const WHEEL_CAP = 100;
const WHEEL_SCALE = 400;
const DRAG_THRESHOLD = 4;
const CENTER = 0.5;

type Fraction = { fx: number; fy: number };
type Anchor = Fraction & { clientX: number; clientY: number };
type Drag = { id: number; x: number; y: number; left: number; top: number; isMoving: boolean };

function boardOf(well: HTMLElement): HTMLElement | null {
  return well.querySelector(".board");
}

function fractionAt(well: HTMLElement, clientX: number, clientY: number): Fraction | null {
  const rect = boardOf(well)?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) {
    return null;
  }
  return { fx: (clientX - rect.left) / rect.width, fy: (clientY - rect.top) / rect.height };
}

function centerOf(well: HTMLElement): { clientX: number; clientY: number } {
  const rect = well.getBoundingClientRect();
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
}

function applyAnchor(well: HTMLElement, anchor: Anchor): void {
  const rect = boardOf(well)?.getBoundingClientRect();
  if (!rect) {
    return;
  }
  well.scrollLeft += rect.left + anchor.fx * rect.width - anchor.clientX;
  well.scrollTop += rect.top + anchor.fy * rect.height - anchor.clientY;
}

function zoomFactor(event: WheelEvent, pageHeight: number): number {
  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? pageHeight
        : 1;
  const delta = event.deltaY * unit;
  const isPinch = event.ctrlKey || event.metaKey;
  const cap = isPinch ? PINCH_CAP : WHEEL_CAP;
  const clamped = Math.max(Math.min(delta, cap), -cap);
  return Math.exp(-clamped / (isPinch ? PINCH_SCALE : WHEEL_SCALE));
}

function suppressNextClick(well: HTMLElement): void {
  const stop = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  well.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => well.removeEventListener("click", stop, { capture: true }), 0);
}

function isOutside(cell: DOMRect, view: DOMRect): boolean {
  return (
    cell.left < view.left ||
    cell.right > view.right ||
    cell.top < view.top ||
    cell.bottom > view.bottom
  );
}

function useWheelZoom(
  wellRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<Anchor | null>,
  isWheelZoom: boolean,
): void {
  useEffect(() => {
    const well = wellRef.current;
    if (!well) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!isWheelZoom && !event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const { zoom, setZoom } = usePlayUi.getState();
      const fraction = fractionAt(well, event.clientX, event.clientY);
      if (fraction) {
        anchorRef.current = { ...fraction, clientX: event.clientX, clientY: event.clientY };
      }
      setZoom(zoom * zoomFactor(event, well.clientHeight));
    };
    well.addEventListener("wheel", onWheel, { passive: false });
    return () => well.removeEventListener("wheel", onWheel);
  }, [wellRef, anchorRef, isWheelZoom]);
}

function useDragPan(wellRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const well = wellRef.current;
    if (!well) {
      return;
    }
    let drag: Drag | null = null;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch" || usePlayUi.getState().zoom <= 1) {
        return;
      }
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: well.scrollLeft,
        top: well.scrollTop,
        isMoving: false,
      };
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) {
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.isMoving && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }
      if (!drag.isMoving) {
        drag.isMoving = true;
        well.setPointerCapture(drag.id);
        well.dataset.panning = "true";
      }
      well.scrollLeft = drag.left - dx;
      well.scrollTop = drag.top - dy;
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) {
        return;
      }
      if (drag.isMoving) {
        suppressNextClick(well);
        delete well.dataset.panning;
      }
      drag = null;
    };
    well.addEventListener("pointerdown", onDown);
    well.addEventListener("pointermove", onMove);
    well.addEventListener("pointerup", onUp);
    well.addEventListener("pointercancel", onUp);
    return () => {
      well.removeEventListener("pointerdown", onDown);
      well.removeEventListener("pointermove", onMove);
      well.removeEventListener("pointerup", onUp);
      well.removeEventListener("pointercancel", onUp);
    };
  }, [wellRef]);
}

function useAnchoredZoom(
  wellRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<Anchor | null>,
): void {
  const zoom = usePlayUi((state) => state.zoom);
  const centerRef = useRef<Fraction>({ fx: CENTER, fy: CENTER });
  const appliedRef = useRef(zoom);

  useEffect(() => {
    const well = wellRef.current;
    if (!well) {
      return;
    }
    const remember = () => {
      const center = centerOf(well);
      const fraction = fractionAt(well, center.clientX, center.clientY);
      if (fraction) {
        centerRef.current = fraction;
      }
    };
    well.addEventListener("scroll", remember, { passive: true });
    return () => well.removeEventListener("scroll", remember);
  }, [wellRef]);

  useLayoutEffect(() => {
    const well = wellRef.current;
    if (!well || appliedRef.current === zoom) {
      return;
    }
    appliedRef.current = zoom;
    const anchor = anchorRef.current ?? { ...centerRef.current, ...centerOf(well) };
    anchorRef.current = null;
    applyAnchor(well, anchor);
    const center = centerOf(well);
    centerRef.current = fractionAt(well, center.clientX, center.clientY) ?? centerRef.current;
  }, [wellRef, anchorRef, zoom]);
}

function useRobotFollow(wellRef: RefObject<HTMLElement | null>, robot: Pos): void {
  const isReduced = usePrefersReducedMotion();
  useEffect(() => {
    const well = wellRef.current;
    if (!well || usePlayUi.getState().zoom <= 1) {
      return;
    }
    const cell = well
      .querySelector(`[data-row="${robot.row}"][data-col="${robot.col}"]`)
      ?.getBoundingClientRect();
    const view = well.getBoundingClientRect();
    if (!cell || !isOutside(cell, view)) {
      return;
    }
    well.scrollBy({
      left: cell.left + cell.width / 2 - (view.left + view.width / 2),
      top: cell.top + cell.height / 2 - (view.top + view.height / 2),
      behavior: isReduced ? "auto" : "smooth",
    });
  }, [wellRef, robot.row, robot.col, isReduced]);
}

export function useWellZoom(
  wellRef: RefObject<HTMLElement | null>,
  robot: Pos,
  isWheelZoom: boolean,
): void {
  const anchorRef = useRef<Anchor | null>(null);
  useWheelZoom(wellRef, anchorRef, isWheelZoom);
  useDragPan(wellRef);
  useAnchoredZoom(wellRef, anchorRef);
  useRobotFollow(wellRef, robot);
}
