import { CURSOR_HOTSPOT, CURSOR_TONES, PICKAXE_CURSOR_ART } from "../pixel/cursor-art.ts";
import { pixelPath } from "../pixel/pixel-art.ts";
import { readStorage, writeStorage } from "./storage.ts";

export type CursorStyle = "system" | "pickaxe";

export const CURSOR_KEY = "minescript.cursor";
const CURSOR_SCALE = 2;
const FALLBACK = "auto";

export function initialCursor(): CursorStyle {
  return readStorage(CURSOR_KEY) === "pickaxe" ? "pickaxe" : "system";
}

function toneColor(tone: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--px-${tone}`).trim();
}

function pickaxeUrl(): string {
  const rows = PICKAXE_CURSOR_ART;
  const width = rows[0]?.length ?? 0;
  const paths = Object.entries(CURSOR_TONES)
    .map(([symbol, tone]) => `<path d="${pixelPath(rows, symbol)}" fill="${toneColor(tone)}"/>`)
    .join("");
  const size = width * CURSOR_SCALE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges">${paths}</svg>`;
  const hotspot = `${CURSOR_HOTSPOT.x * CURSOR_SCALE} ${CURSOR_HOTSPOT.y * CURSOR_SCALE}`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot}, ${FALLBACK}`;
}

export function applyCursor(style: CursorStyle): void {
  const root = document.documentElement;
  if (style === "pickaxe") {
    root.style.setProperty("--cursor-pick", pickaxeUrl());
    root.dataset.cursor = "pickaxe";
    return;
  }
  root.style.removeProperty("--cursor-pick");
  delete root.dataset.cursor;
}

export function saveCursor(style: CursorStyle): void {
  applyCursor(style);
  writeStorage(CURSOR_KEY, style);
}
