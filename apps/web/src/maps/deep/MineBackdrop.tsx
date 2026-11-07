import { type RefObject, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../lib/motion.ts";
import { readStorage, writeStorage } from "../../lib/storage.ts";
import { MINE_ATTR, startDeepScene } from "./start.ts";
import "./MineBackdrop.css";

type MineBackdropProps = {
  rootRef: RefObject<HTMLElement | null>;
  mapIds: readonly number[];
  layoutKey: string;
};

const SEEN_KEY = "minescript.mine.seen";
const RESTART_DELAY_MS = 150;
const ARRIVE_MS = 900;

function readSeen(): Set<number> | null {
  const raw = readStorage(SEEN_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is number => typeof v === "number"))
      : null;
  } catch {
    return null;
  }
}

function pickDig(mapIds: readonly number[]): number | null {
  if (mapIds.length === 0) return null;
  const seen = readSeen();
  writeStorage(SEEN_KEY, JSON.stringify([...new Set([...(seen ?? []), ...mapIds])]));
  if (!seen) return null;
  const fresh = mapIds.filter((id) => !seen.has(id));
  return fresh.length > 0 ? Math.max(...fresh) : null;
}

function levelIndex(root: HTMLElement, target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const level = target.closest(`[${MINE_ATTR}="level"]`);
  if (!level) return null;
  const index = [...root.querySelectorAll(`[${MINE_ATTR}="level"]`)].indexOf(level);
  return index < 0 ? null : index;
}

export function MineBackdrop({ rootRef, mapIds, layoutKey }: MineBackdropProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<number | null>(null);
  const digRef = useRef<number | null>(null);
  const idsKey = mapIds.join(",");
  const isStatic = usePrefersReducedMotion();

  useEffect(() => {
    digRef.current = pickDig(idsKey.length > 0 ? idsKey.split(",").map(Number) : []);
  }, [idsKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const enter = (event: Event) => {
      targetRef.current = levelIndex(root, event.target);
    };
    const leave = () => {
      targetRef.current = null;
    };
    root.addEventListener("pointerover", enter);
    root.addEventListener("focusin", enter);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("focusout", leave);
    return () => {
      root.removeEventListener("pointerover", enter);
      root.removeEventListener("focusin", enter);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("focusout", leave);
    };
  }, [rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (
      !root ||
      !canvas ||
      !wrap ||
      typeof ResizeObserver === "undefined" ||
      layoutKey.length === 0
    )
      return;
    let stop: () => void = () => undefined;
    let timer = 0;
    const arrivals: number[] = [];
    const start = () => {
      stop();
      const digId = digRef.current;
      digRef.current = null;
      stop = startDeepScene({
        root,
        canvas,
        paletteSource: wrap,
        isStatic,
        digId,
        target: () => targetRef.current,
        onDigStart: (element) => {
          element.dataset.digging = "true";
          element.scrollIntoView({ block: "center", behavior: isStatic ? "auto" : "smooth" });
        },
        onDigDone: (element) => {
          delete element.dataset.digging;
          element.dataset.arriving = "true";
          arrivals.push(window.setTimeout(() => delete element.dataset.arriving, ARRIVE_MS));
        },
      });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(start, RESTART_DELAY_MS);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    schedule();
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      for (const id of arrivals) window.clearTimeout(id);
      stop();
    };
  }, [rootRef, layoutKey, isStatic]);

  return (
    <div ref={wrapRef} className="deep" data-theme="tarna" aria-hidden="true">
      <canvas ref={canvasRef} className="deep-canvas" />
    </div>
  );
}
