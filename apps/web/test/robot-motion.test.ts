import { describe, expect, test } from "vitest";
import { cubicBezier, motionFrames, motionMs, moveFrames } from "../src/mine/robot-motion.ts";

function pixels(value: unknown): number[] {
  return (
    String(value)
      .match(/-?\d+(\.\d+)?(?=px)/g)
      ?.map(Number) ?? []
  );
}

describe("pixelre illesztett robotmozgás", () => {
  test("a görbe a két végponton pontos", () => {
    const ease = cubicBezier(0.5, 0, 0.3, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.4);
  });

  test("a lépés minden képkockája egész eszközpixelen áll, és lassulva ér célba", () => {
    const frames = moveFrames({ x: 0, y: 0 }, { x: 48, y: 0 }, 2, 300);
    const xs = frames.map((frame) => pixels(frame.transform)[0] ?? 0);
    expect(xs.every((x) => Number.isInteger(x * 2))).toBe(true);
    expect(xs[0]).toBe(0);
    expect(xs.at(-1)).toBe(48);
    expect(frames.at(-1)?.offset).toBe(1);
    expect(xs.every((x, i) => i === 0 || x >= (xs[i - 1] ?? 0))).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(40);
  });

  test("a falnak ütközés előre lódul, majd visszaáll", () => {
    const frames = motionFrames("bump", 48, 1, motionMs("bump", 250));
    const ys = frames.map((frame) => pixels(frame.translate)[1] ?? 0);
    expect(Math.min(...ys)).toBe(-8);
    expect(Math.max(...ys)).toBe(3);
    expect(ys.at(-1)).toBe(0);
    expect(ys.every(Number.isInteger)).toBe(true);
  });

  test("az ásás és a menet a lépésidőhöz igazodik, a rázkódás fix hosszú", () => {
    expect(motionMs("walk", 100)).toBe(200);
    expect(motionMs("mine", 500)).toBe(500);
    expect(motionMs("shake", 900)).toBe(420);
    expect(motionMs("still", 500)).toBe(0);
    expect(motionFrames("still", 48, 1, 300)).toEqual([]);
  });
});
