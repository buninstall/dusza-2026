import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { hu } from "../i18n/hu.ts";
import { SHEET_SHARE, usePlayUi } from "./play-ui-store.ts";
import "./SplitHandle.css";

const KEY_STEP = 2;
const PAGE_STEP = 10;
const PERCENT = 100;
const SHEET_MIN_REM = 18.75;
const STAGE_MIN_REM = 35;
const INITIAL_MAX_REM = 25;

type Bounds = { min: number; max: number; initial: number };

const FALLBACK: Bounds = {
  min: SHEET_SHARE.min,
  max: SHEET_SHARE.max,
  initial: SHEET_SHARE.initial,
};

type SplitHandleProps = {
  containerRef: RefObject<HTMLElement | null>;
  controls: string;
};

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function boundsOf(container: HTMLElement | null): Bounds {
  const width = container?.getBoundingClientRect().width ?? 0;
  if (!container || width <= 0) {
    return FALLBACK;
  }
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const split = Number.parseFloat(getComputedStyle(container).getPropertyValue("--split-w")) || 0;
  const share = (pixels: number) => (pixels / width) * PERCENT;
  const fits = Math.floor(share(width - STAGE_MIN_REM * rem - split));
  const max = Math.max(Math.min(SHEET_SHARE.max, fits), SHEET_SHARE.min);
  const min = clamp(Math.ceil(share(SHEET_MIN_REM * rem)), SHEET_SHARE.min, max);
  const initial = Math.round(
    clamp(Math.min(SHEET_SHARE.initial, share(INITIAL_MAX_REM * rem)), min, max),
  );
  return { min, max, initial };
}

function useBounds(containerRef: RefObject<HTMLElement | null>): Bounds {
  const [bounds, setBounds] = useState<Bounds>(FALLBACK);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const measure = () => setBounds(boundsOf(container));
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);
  return bounds;
}

function shareAt(container: HTMLElement, clientX: number): number {
  const rect = container.getBoundingClientRect();
  if (rect.width <= 0) {
    return SHEET_SHARE.initial;
  }
  const { min, max } = boundsOf(container);
  return clamp(((clientX - rect.left) / rect.width) * PERCENT, min, max);
}

function keyedShare(key: string, share: number, bounds: Bounds): number | null {
  switch (key) {
    case "ArrowLeft":
      return share - KEY_STEP;
    case "ArrowRight":
      return share + KEY_STEP;
    case "PageDown":
      return share - PAGE_STEP;
    case "PageUp":
      return share + PAGE_STEP;
    case "Home":
      return bounds.min;
    case "End":
      return bounds.max;
    default:
      return null;
  }
}

export function SplitHandle({ containerRef, controls }: SplitHandleProps) {
  const stored = usePlayUi((state) => state.sheetShare);
  const setSheetShare = usePlayUi((state) => state.setSheetShare);
  const dragRef = useRef<{ share: number; isMoved: boolean } | null>(null);
  const bounds = useBounds(containerRef);
  const shown = Math.round(clamp(stored ?? bounds.initial, bounds.min, bounds.max));

  const preview = (next: number) => {
    containerRef.current?.style.setProperty("--sheet-share", `${next}%`);
  };

  const onPointerDown = (event: PointerEvent<HTMLHRElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    dragRef.current = { share: shown, isMoved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLHRElement>) => {
    const container = containerRef.current;
    if (dragRef.current === null || !container) {
      return;
    }
    dragRef.current = { share: shareAt(container, event.clientX), isMoved: true };
    preview(dragRef.current.share);
  };

  const onPointerUp = (event: PointerEvent<HTMLHRElement>) => {
    if (dragRef.current === null) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragRef.current.isMoved) {
      setSheetShare(Math.round(dragRef.current.share));
    }
    dragRef.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
    const next = keyedShare(event.key, shown, bounds);
    if (next === null) {
      return;
    }
    event.preventDefault();
    setSheetShare(clamp(next, bounds.min, bounds.max));
  };

  return (
    <hr
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={hu.play.splitLabel}
      aria-controls={controls}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={shown}
      aria-valuetext={hu.play.splitValue(shown)}
      className="split-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => setSheetShare(null)}
      onKeyDown={onKeyDown}
    />
  );
}
