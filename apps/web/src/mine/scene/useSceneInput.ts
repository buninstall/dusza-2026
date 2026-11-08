import { type RefObject, useEffect, useRef } from "react";

const DRAG_THRESHOLD = 4;
const LINE_PX = 16;
const PINCH_SCALE = 100;
const PINCH_CAP = 25;
const WHEEL_SCALE = 400;
const WHEEL_CAP = 100;
const MIDDLE = 1;

export type PanButton = "primary" | "secondary";

export type SceneInputHandlers = {
  panBy: (dxPx: number, dyPx: number) => void;
  zoomAt: (factor: number, clientX: number, clientY: number) => void;
  canPan: () => boolean;
  isWheelZoom: () => boolean;
  onPanning: (isPanning: boolean) => void;
};

type Drag = { id: number; x: number; y: number; isMoving: boolean };

function wheelDelta(event: WheelEvent, page: number): { x: number; y: number } {
  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? page
        : 1;
  return { x: event.deltaX * unit, y: event.deltaY * unit };
}

function isPanStart(event: PointerEvent, mode: PanButton, isSpace: boolean): boolean {
  if (event.pointerType === "touch") {
    return mode === "primary";
  }
  if (mode === "primary") {
    return event.button === 0 || event.button === MIDDLE;
  }
  return event.button === MIDDLE || (event.button === 0 && isSpace);
}

function suppressClick(element: HTMLElement): void {
  const stop = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  element.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => element.removeEventListener("click", stop, { capture: true }), 0);
}

export function useSceneInput(
  ref: RefObject<HTMLElement | null>,
  mode: PanButton,
  handlers: SceneInputHandlers,
): void {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let drag: Drag | null = null;
    let isSpace = false;
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: number | null = null;

    const onWheel = (event: WheelEvent) => {
      const delta = wheelDelta(event, element.clientHeight);
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const clamped = Math.max(Math.min(delta.y, PINCH_CAP), -PINCH_CAP);
        latest.current.zoomAt(Math.exp(-clamped / PINCH_SCALE), event.clientX, event.clientY);
        return;
      }
      if (latest.current.canPan()) {
        event.preventDefault();
        latest.current.panBy(-delta.x, -delta.y);
        return;
      }
      if (latest.current.isWheelZoom() && delta.y !== 0) {
        event.preventDefault();
        const clamped = Math.max(Math.min(delta.y, WHEEL_CAP), -WHEEL_CAP);
        latest.current.zoomAt(Math.exp(-clamped / WHEEL_SCALE), event.clientX, event.clientY);
      }
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
          drag = null;
          return;
        }
      }
      if (!isPanStart(event, mode, isSpace) || !latest.current.canPan()) {
        return;
      }
      if (mode === "secondary" || isSpace) {
        event.stopPropagation();
        event.preventDefault();
      }
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, isMoving: false };
    };

    const onMove = (event: PointerEvent) => {
      if (touches.has(event.pointerId)) {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (pinch !== null && touches.size === 2) {
        const [a, b] = [...touches.values()];
        if (a && b) {
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          latest.current.zoomAt(distance / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
          pinch = distance;
        }
        return;
      }
      if (!drag || drag.id !== event.pointerId) {
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.isMoving && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }
      if (!drag.isMoving) {
        drag.isMoving = true;
        element.setPointerCapture(event.pointerId);
        latest.current.onPanning(true);
      }
      latest.current.panBy(dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };

    const onUp = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (touches.size < 2) {
        pinch = null;
      }
      if (!drag || drag.id !== event.pointerId) {
        return;
      }
      if (drag.isMoving) {
        suppressClick(element);
        latest.current.onPanning(false);
      }
      drag = null;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
        isSpace = event.type === "keydown";
        element.dataset.grab = String(isSpace);
      }
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onDown, { capture: true });
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    if (mode === "secondary") {
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);
    }
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onDown, { capture: true });
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [ref, mode]);
}
