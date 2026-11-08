import { type RefObject, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { startLampScene } from "./lamp/scene.ts";

type LampSceneProps = { panelRef: RefObject<HTMLElement | null> };

const RESTART_DELAY_MS = 120;

export function LampScene({ panelRef }: LampSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isStatic = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const panel = panelRef.current;
    const root = canvas?.closest<HTMLElement>(".auth");
    if (!canvas || !panel || !root || typeof ResizeObserver === "undefined") {
      return;
    }
    const isRevealed = document.documentElement.dataset.lampReveal === "all";
    const host = { root, canvas, panel, isStatic, isRevealed };
    let scene = startLampScene(host);
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      if (scene.relayout()) {
        return;
      }
      timer = window.setTimeout(() => {
        scene.stop();
        scene = startLampScene(host);
      }, RESTART_DELAY_MS);
    });
    observer.observe(root);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      scene.stop();
    };
  }, [panelRef, isStatic]);

  return (
    <div className="auth-scene" data-theme="tarna" aria-hidden="true">
      <canvas ref={canvasRef} className="auth-scene-canvas" />
    </div>
  );
}
