import { type RefObject, useEffect } from "react";
import { readStorage, writeStorage } from "./storage.ts";

const KEY = "minescript.rust-wear";
const TICK_MS = 10_000;
const TAU_SECONDS = 3600;
const RUN_SECONDS = 45;
const LEVELS = 4;
const MAX_STORED = 86_400;

let seconds = loadSeconds();
const listeners = new Set<() => void>();

function loadSeconds(): number {
  const stored = Number(readStorage(KEY));
  return Number.isFinite(stored) && stored > 0 ? Math.min(stored, MAX_STORED) : 0;
}

export function rustFraction(totalSeconds: number): number {
  const safe = Math.max(totalSeconds, 0);
  return 1 - Math.exp(-safe / TAU_SECONDS);
}

export function rustLevel(fraction: number): number {
  return Math.min(LEVELS, Math.floor(Math.max(fraction, 0) * (LEVELS + 1)));
}

function addSeconds(amount: number): void {
  seconds = Math.min(seconds + amount, MAX_STORED);
  writeStorage(KEY, String(Math.round(seconds)));
  for (const listener of listeners) {
    listener();
  }
}

export function addRunWear(): void {
  addSeconds(RUN_SECONDS);
}

function paint(element: HTMLElement): void {
  const fraction = rustFraction(seconds);
  element.style.setProperty(
    "--rust",
    `calc(var(--rust-min) + (var(--rust-max) - var(--rust-min)) * ${fraction.toFixed(3)})`,
  );
  element.dataset.rust = String(rustLevel(fraction));
}

export function useRustWear(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const repaint = () => paint(element);
    repaint();
    listeners.add(repaint);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        addSeconds(TICK_MS / 1000);
      }
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
      listeners.delete(repaint);
    };
  }, [ref]);
}
