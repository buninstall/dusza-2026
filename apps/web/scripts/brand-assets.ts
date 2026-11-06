import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOCKUP_HEIGHT,
  LOCKUP_WIDTH,
  MARK_ROWS,
  MARK_TONES,
  WORDMARK_ROWS,
  WORDMARK_TONES,
  WORDMARK_X,
  WORDMARK_Y,
} from "../src/pixel/logo-art.ts";
import { type PixelRows, pixelPath } from "../src/pixel/pixel-art.ts";

const PUBLIC = join(import.meta.dirname, "..", "public");
const BRAND = join(PUBLIC, "brand");

const STEEL: Record<string, string> = {
  "steel-edge": "#15181b",
  "steel-hi": "#dfe5e9",
  steel: "#a3adb5",
  "steel-lo": "#6b7681",
  tread: "#2c3034",
  visor: "#52d6de",
  lamp: "#fff7cf",
  "ore-edge": "#4a2c08",
  ore: "#f0b232",
  "ore-hi": "#ffe58a",
  "ore-lo": "#b8741b",
};

const TILE = "#0a0908";
const TILE_EDGE = "#7d6e5e";

type Ink = { ink: string; "ink-gold": string };

const DARK_INK: Ink = { ink: "#f1e7d3", "ink-gold": "#f2b53a" };
const LIGHT_INK: Ink = { ink: "#1e1a16", "ink-gold": "#7a4c00" };

function layers(
  rows: PixelRows,
  tones: Readonly<Record<string, string>>,
  colors: Readonly<Record<string, string>>,
  dx: number,
  dy: number,
): string {
  return Object.entries(tones)
    .map(([symbol, tone]) => {
      const path = pixelPath(rows, symbol, dx, dy);
      return path ? `<path fill="${colors[tone] ?? "#000000"}" d="${path}"/>` : "";
    })
    .join("");
}

function markTile(dx: number, dy: number): string {
  const edge = 0.5;
  return [
    `<rect x="${dx}" y="${dy}" width="16" height="16" fill="${TILE}"/>`,
    `<path fill="${TILE_EDGE}" d="M${dx} ${dy}h16v${edge}h-16zM${dx} ${dy + 16 - edge}h16v${edge}h-16zM${dx} ${dy}h${edge}v16h-${edge}zM${dx + 16 - edge} ${dy}h${edge}v16h-${edge}z"/>`,
    layers(MARK_ROWS, MARK_TONES, STEEL, dx, dy),
  ].join("");
}

function lockup(ink: Ink, dx: number, dy: number): string {
  return [
    markTile(dx, dy),
    layers(WORDMARK_ROWS, WORDMARK_TONES, ink, dx + WORDMARK_X, dy + WORDMARK_Y),
  ].join("");
}

function svg(viewBox: string, body: string, size: string): string {
  const attributes = [`viewBox="${viewBox}"`, size, 'shape-rendering="crispEdges"'].filter(Boolean);
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attributes.join(" ")}><title>MineScript</title>${body}</svg>\n`;
}

const README_SCALE = 6;
const SOCIAL = { width: 1280, height: 640, scale: 10, band: 32 };

function socialPreview(): string {
  const art = { width: LOCKUP_WIDTH * SOCIAL.scale, height: LOCKUP_HEIGHT * SOCIAL.scale };
  const x = (SOCIAL.width - art.width) / 2 / SOCIAL.scale;
  const y = (SOCIAL.height - SOCIAL.band - art.height) / 2 / SOCIAL.scale;
  const units = { width: SOCIAL.width / SOCIAL.scale, height: SOCIAL.height / SOCIAL.scale };
  const band = SOCIAL.band / SOCIAL.scale;
  const stripes = Array.from({ length: units.width / band + 1 }, (_, index) => {
    const left = index * band;
    return `M${left} ${units.height - band}h${band / 2}l-${band / 2} ${band}h-${band / 2}z`;
  }).join("");
  const body = [
    `<rect width="${units.width}" height="${units.height}" fill="#110f0d"/>`,
    lockup(DARK_INK, x, y),
    `<rect y="${units.height - band}" width="${units.width}" height="${band}" fill="#f2c21b"/>`,
    `<path fill="#15120f" d="${stripes}"/>`,
  ].join("");
  return svg(
    `0 0 ${units.width} ${units.height}`,
    body,
    `width="${SOCIAL.width}" height="${SOCIAL.height}"`,
  );
}

function favicon(): string {
  const body = [
    '<rect x="-1" y="-1" width="18" height="18" fill="#110f0d"/>',
    layers(MARK_ROWS, MARK_TONES, STEEL, 0, 0),
  ].join("");
  return svg("-1 -1 18 18", body, "");
}

mkdirSync(BRAND, { recursive: true });
const size = `width="${LOCKUP_WIDTH * README_SCALE}" height="${LOCKUP_HEIGHT * README_SCALE}"`;
const viewBox = `0 0 ${LOCKUP_WIDTH} ${LOCKUP_HEIGHT}`;
writeFileSync(join(BRAND, "minescript-dark.svg"), svg(viewBox, lockup(DARK_INK, 0, 0), size));
writeFileSync(join(BRAND, "minescript-light.svg"), svg(viewBox, lockup(LIGHT_INK, 0, 0), size));
writeFileSync(join(BRAND, "social-preview.svg"), socialPreview());
writeFileSync(join(PUBLIC, "favicon.svg"), favicon());
