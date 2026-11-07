import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { startWall } from "../maps/deep/wall.ts";
import "../maps/deep/MineBackdrop.css";

const REBUILD_GAP_MS = 220;

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): string {
  return document.documentElement.dataset.theme ?? "tarna";
}

function contentBox(main: HTMLElement): { x0: number; x1: number } {
  const r = main.getBoundingClientRect();
  const style = getComputedStyle(main);
  return {
    x0: r.left + Number.parseFloat(style.paddingLeft || "0"),
    x1: r.right - Number.parseFloat(style.paddingRight || "0"),
  };
}

export function PageBackdrop({ routeKey, isCalm }: { routeKey: string; isCalm: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "tarna");
  const isStatic = usePrefersReducedMotion();
  const isOn = theme !== "felszin";

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const main = document.getElementById("main");
    const header = document.querySelector(".shell-header");
    if (!isOn || !wrap || !canvas || !main || !header || routeKey.length === 0) return;
    let stop: () => void = () => undefined;
    let timer = 0;
    let lastBuild = 0;
    let shape = "";
    const measure = () => `${window.innerWidth}:${document.documentElement.scrollHeight}`;
    const start = () => {
      window.clearTimeout(timer);
      stop();
      shape = measure();
      lastBuild = performance.now();
      stop =
        startWall({
          canvas,
          front: frontRef.current,
          paletteSource: wrap,
          roofY: header.getBoundingClientRect().bottom + window.scrollY,
          safe: contentBox(main),
          isCalm,
          isStatic,
        }) ?? (() => undefined);
    };
    const onChange = () => {
      if (measure() === shape) return;
      const wait = REBUILD_GAP_MS - (performance.now() - lastBuild);
      window.clearTimeout(timer);
      timer = window.setTimeout(start, Math.max(0, wait));
    };
    start();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onChange);
    observer?.observe(main);
    window.addEventListener("resize", onChange);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onChange);
      window.clearTimeout(timer);
      stop();
    };
  }, [isOn, isStatic, routeKey, isCalm]);

  if (!isOn) return null;
  return (
    <>
      <div ref={wrapRef} className="deep deep-page" data-theme="tarna" aria-hidden="true">
        <canvas ref={canvasRef} className="deep-canvas" />
      </div>
      <div className="deep deep-front" aria-hidden="true">
        <canvas ref={frontRef} className="deep-canvas" />
      </div>
    </>
  );
}
