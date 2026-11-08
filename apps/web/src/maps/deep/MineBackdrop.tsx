import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { holdReady, releaseAfterPaint } from "../../app/readiness.ts";
import { usePrefersReducedMotion } from "../../lib/motion.ts";
import { readStorage, writeStorage } from "../../lib/storage.ts";
import { MINE_ATTR, startDeepScene } from "./start.ts";
import "./MineBackdrop.css";

type MineBackdropProps = {
  rootRef: RefObject<HTMLElement | null>;
  mapIds: readonly number[];
  layoutKey: string;
  seenKey?: string;
};

const SEEN_KEY = "minescript.mine.seen";

function readSeen(key: string): Set<number> | null {
  const raw = readStorage(key);
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

function pickDig(mapIds: readonly number[], key: string): number | null {
  if (mapIds.length === 0) return null;
  const seen = readSeen(key);
  writeStorage(key, JSON.stringify([...new Set([...(seen ?? []), ...mapIds])]));
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

export function MineBackdrop({
  rootRef,
  mapIds,
  layoutKey,
  seenKey = SEEN_KEY,
}: MineBackdropProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<number | null>(null);
  const digRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const sceneRef = useRef<(() => void) | null>(null);
  const idsKey = mapIds.join(",");
  const isStatic = usePrefersReducedMotion();

  useLayoutEffect(() => {
    digRef.current = pickDig(idsKey.length > 0 ? idsKey.split(",").map(Number) : [], seenKey);
  }, [idsKey, seenKey]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const mid = midRef.current;
    const wrap = wrapRef.current;
    if (!root || !canvas || !mid || !wrap || layoutKey.length === 0) return;
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
    let signature = "";
    const shape = () =>
      `${window.innerWidth}:${root.offsetWidth}x${root.offsetHeight}:${root.querySelectorAll(`[${MINE_ATTR}]`).length}`;
    const start = () => {
      sceneRef.current?.();
      sceneRef.current = null;
      signature = shape();
      const digId = digRef.current;
      const release = hasStartedRef.current ? () => undefined : holdReady();
      const next = startDeepScene({
        root,
        canvas,
        mid,
        front: frontRef.current,
        paletteSource: wrap,
        isStatic,
        isFresh: !hasStartedRef.current,
        digId,
        target: () => targetRef.current,
        onDigStart: () => undefined,
        onDigDone: () => undefined,
      });
      sceneRef.current = next;
      releaseAfterPaint(release);
      if (next) {
        digRef.current = null;
        hasStartedRef.current = true;
      }
    };
    const onResize = () => {
      if (shape() !== signature) start();
    };
    let frame = 0;
    const onContent = () => {
      if (frame || shape() === signature) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (shape() !== signature) start();
      });
    };
    start();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    observer?.observe(root);
    const mutations = new MutationObserver(onContent);
    mutations.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", onResize);
    return () => {
      root.removeEventListener("pointerover", enter);
      root.removeEventListener("focusin", enter);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("focusout", leave);
      observer?.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [rootRef, layoutKey, isStatic]);

  useEffect(
    () => () => {
      sceneRef.current?.();
      sceneRef.current = null;
    },
    [],
  );

  return (
    <>
      <div ref={wrapRef} className="deep" data-theme="tarna" aria-hidden="true">
        <canvas ref={canvasRef} className="deep-canvas" />
        <canvas ref={midRef} className="deep-canvas" />
      </div>
      <div className="deep deep-front" aria-hidden="true">
        <canvas ref={frontRef} className="deep-canvas" />
      </div>
    </>
  );
}
