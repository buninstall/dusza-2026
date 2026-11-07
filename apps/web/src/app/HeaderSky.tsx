import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { readDeepPalette } from "../maps/deep/palette.ts";
import { dither, hash, toneHex } from "../maps/deep/world.ts";

const SCALE = 3;
const TWINKLE_MS = 220;
const STAR_DENSITY = 0.0045;

type Star = { x: number; y: number; phase: number; bright: number };

function paintSky(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  palette: Readonly<Record<string, string>>,
): void {
  const tones = ["sky-0", "sky-1", "sky-2"].map((tone) => toneHex(palette, tone));
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = y / Math.max(1, H) + (dither(x, y) - 0.5) * 0.35;
      ctx.fillStyle = tones[t < 0.55 ? 0 : 1] ?? "";
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paintStars(
  ctx: CanvasRenderingContext2D,
  stars: readonly Star[],
  palette: Readonly<Record<string, string>>,
  time: number,
): void {
  for (const s of stars) {
    const tw = Math.sin(time * (1 + s.bright) + s.phase);
    const tone = tw < -0.2 ? "sky-1" : tw > 0.9 && s.bright > 0.85 ? "star" : "star-dim";
    ctx.fillStyle = toneHex(palette, tone);
    ctx.fillRect(s.x, s.y, 1, 1);
  }
}

export function HeaderSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isStatic = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx || typeof ResizeObserver === "undefined") return;
    let timer = 0;
    let stars: Star[] = [];
    const palette = readDeepPalette(host);
    const draw = (time: number) => paintStars(ctx, stars, palette, time);
    const layout = () => {
      const W = Math.ceil(host.clientWidth / SCALE);
      const H = Math.ceil(host.clientHeight / SCALE);
      if (W < 1 || H < 1) return;
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * SCALE}px`;
      canvas.style.height = `${H * SCALE}px`;
      stars = Array.from({ length: Math.round(W * H * STAR_DENSITY) }, (_, i) => ({
        x: Math.floor(hash(i, 11) * W),
        y: Math.floor(hash(i, 23) * H),
        phase: hash(i, 37) * 6,
        bright: hash(i, 51),
      }));
      paintSky(ctx, W, H, palette);
      draw(0);
    };
    const observer = new ResizeObserver(layout);
    observer.observe(host);
    layout();
    if (!isStatic) timer = window.setInterval(() => draw(performance.now() / 1000), TWINKLE_MS);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [isStatic]);

  return (
    <span className="shell-sky" aria-hidden="true">
      <canvas ref={canvasRef} className="shell-sky-canvas" />
    </span>
  );
}
