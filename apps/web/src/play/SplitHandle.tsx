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
const STAGE_MIN_REM = 36;
const INITIAL_MAX_REM = 28;

type Bounds = { max: number; initial: number };

type SplitHandleProps = {
  containerRef: RefObject<HTMLElement | null>;
  controls: string;
};

function boundsOf(container: HTMLElement | null): Bounds {
  const width = container?.getBoundingClientRect().width ?? 0;
  if (!container || width <= 0) {
    return { max: SHEET_SHARE.max, initial: SHEET_SHARE.initial };
  }
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const split = Number.parseFloat(getComputedStyle(container).getPropertyValue("--split-w")) || 0;
  const fits = ((width - STAGE_MIN_REM * rem - split) / width) * PERCENT;
  const max = Math.max(Math.min(SHEET_SHARE.max, Math.floor(fits)), SHEET_SHARE.min);
  const capped = ((INITIAL_MAX_REM * rem) / width) * PERCENT;
  const initial = Math.round(
    Math.min(Math.max(Math.min(SHEET_SHARE.initial, capped), SHEET_SHARE.min), max),
  );
  return { max, initial };
}

function useBounds(containerRef: RefObject<HTMLElement | null>): Bounds {
  const [bounds, setBounds] = useState<Bounds>({
    max: SHEET_SHARE.max,
    initial: SHEET_SHARE.initial,
  });
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

function clampShare(share: number, max: number): number {
  return Math.min(Math.max(share, SHEET_SHARE.min), max);
}

function shareAt(container: HTMLElement, clientX: number): number {
  const rect = container.getBoundingClientRect();
  if (rect.width <= 0) {
    return SHEET_SHARE.initial;
  }
  return clampShare(((clientX - rect.left) / rect.width) * PERCENT, boundsOf(container).max);
}

function keyedShare(key: string, share: number, max: number): number | null {
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
      return SHEET_SHARE.min;
    case "End":
      return max;
    default:
      return null;
  }
}

export function SplitHandle({ containerRef, controls }: SplitHandleProps) {
  const stored = usePlayUi((state) => state.sheetShare);
  const setSheetShare = usePlayUi((state) => state.setSheetShare);
  const dragRef = useRef<{ share: number; isMoved: boolean } | null>(null);
  const { max, initial } = useBounds(containerRef);
  const shown = Math.round(Math.min(stored ?? initial, max));

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
    const next = keyedShare(event.key, shown, max);
    if (next === null) {
      return;
    }
    event.preventDefault();
    setSheetShare(clampShare(next, max));
  };

  return (
    <hr
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={hu.play.splitLabel}
      aria-controls={controls}
      aria-valuemin={SHEET_SHARE.min}
      aria-valuemax={max}
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
