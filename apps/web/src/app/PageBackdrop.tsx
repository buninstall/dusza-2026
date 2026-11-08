import { useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { fadeOut, RESIZE_SETTLE_MS, type Shot, snapshot, stretch } from "../maps/deep/crossfade.ts";
import { startWall } from "../maps/deep/wall.ts";
import { pageHeight } from "../maps/deep/world.ts";
import { holdReady, releaseAfterPaint } from "./readiness.ts";
import "../maps/deep/MineBackdrop.css";

function contentBox(main: HTMLElement): { x0: number; x1: number } {
  const r = main.getBoundingClientRect();
  const style = getComputedStyle(main);
  return {
    x0: r.left + Number.parseFloat(style.paddingLeft || "0"),
    x1: r.right - Number.parseFloat(style.paddingRight || "0"),
  };
}

type PageBackdropProps = { routeKey: string; isCalm: boolean };

export function PageBackdrop({ routeKey, isCalm }: PageBackdropProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const isStatic = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const mid = midRef.current;
    const main = document.getElementById("main");
    const header = document.querySelector(".shell-header");
    if (!wrap || !canvas || !mid || !main || !header || routeKey.length === 0) return;
    let stop: () => void = () => undefined;
    let shape = "";
    let hasBuilt = false;
    let shots: Shot[] = [];
    let settle = 0;
    let lastWidth = window.innerWidth;
    const measure = () => `${window.innerWidth}:${pageHeight()}`;
    const start = () => {
      window.clearTimeout(settle);
      stop();
      lastWidth = window.innerWidth;
      shape = measure();
      const release = hasBuilt ? () => undefined : holdReady();
      hasBuilt = true;
      stop =
        startWall({
          canvas,
          mid,
          front: frontRef.current,
          paletteSource: wrap,
          roofY: header.getBoundingClientRect().bottom + window.scrollY,
          safe: contentBox(main),
          isCalm,
          isStatic: isStatic || isCalm,
        }) ?? (() => undefined);
      releaseAfterPaint(release);
      fadeOut(shots, isStatic);
      shots = [];
    };
    const onChange = () => {
      if (window.innerWidth !== lastWidth && hasBuilt) {
        if (shots.length === 0) {
          const shot = snapshot(wrap, [canvas, mid]);
          shots = shot ? [shot] : [];
          stop();
          stop = () => undefined;
        }
        stretch(shots);
        window.clearTimeout(settle);
        settle = window.setTimeout(start, RESIZE_SETTLE_MS);
        return;
      }
      if (shots.length === 0 && measure() !== shape) start();
    };
    start();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onChange);
    observer?.observe(main);
    window.addEventListener("resize", onChange);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onChange);
      window.clearTimeout(settle);
      stop();
      fadeOut(shots, true);
    };
  }, [isStatic, routeKey, isCalm]);

  return (
    <>
      <div ref={wrapRef} className="deep deep-page" data-theme="tarna" aria-hidden="true">
        <canvas ref={canvasRef} className="deep-canvas" />
        <canvas ref={midRef} className="deep-canvas" />
      </div>
      <div className="deep deep-front" aria-hidden="true">
        <canvas ref={frontRef} className="deep-canvas" />
      </div>
    </>
  );
}
