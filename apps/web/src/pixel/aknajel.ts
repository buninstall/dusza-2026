import { type PixelRows, pixelPath } from "./pixel-art.ts";

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 10;
const ADVANCE = GLYPH_WIDTH + 1;
const SPACE_ADVANCE = 3;
const INK = "#";
const BLANK = ".....";

const ACUTE: PixelRows = ["...#.", "..#.."];
const DOUBLE_ACUTE: PixelRows = ["..#.#", ".#.#."];
const UMLAUT: PixelRows = [BLANK, ".#.#."];
const NO_ACCENT: PixelRows = [BLANK, BLANK];

const CAPS: Readonly<Record<string, PixelRows>> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["###..", "#..#.", "#...#", "#...#", "#...#", "#..#.", "###.."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ".": [BLANK, BLANK, BLANK, BLANK, BLANK, ".##..", ".##.."],
  ":": [BLANK, ".##..", ".##..", BLANK, ".##..", ".##..", BLANK],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "+": [BLANK, "..#..", "..#..", "#####", "..#..", "..#..", BLANK],
  "-": [BLANK, BLANK, BLANK, ".###.", BLANK, BLANK, BLANK],
  "–": [BLANK, BLANK, BLANK, "#####", BLANK, BLANK, BLANK],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "×": [BLANK, "#...#", ".#.#.", "..#..", ".#.#.", "#...#", BLANK],
  "·": [BLANK, BLANK, BLANK, ".##..", ".##..", BLANK, BLANK],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", BLANK, "..#.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", BLANK, "..#.."],
};

const ACCENTED: Readonly<Record<string, { base: string; accent: PixelRows }>> = {
  Á: { base: "A", accent: ACUTE },
  É: { base: "E", accent: ACUTE },
  Í: { base: "I", accent: ACUTE },
  Ó: { base: "O", accent: ACUTE },
  Ö: { base: "O", accent: UMLAUT },
  Ő: { base: "O", accent: DOUBLE_ACUTE },
  Ú: { base: "U", accent: ACUTE },
  Ü: { base: "U", accent: UMLAUT },
  Ű: { base: "U", accent: DOUBLE_ACUTE },
};

function cell(accent: PixelRows, body: PixelRows): PixelRows {
  return [...accent, BLANK, ...body];
}

export function glyphRows(char: string): PixelRows | null {
  const plain = CAPS[char];
  if (plain) {
    return cell(NO_ACCENT, plain);
  }
  const accented = ACCENTED[char];
  const base = accented ? CAPS[accented.base] : undefined;
  return accented && base ? cell(accented.accent, base) : null;
}

export function toSignCase(text: string): string {
  return text.toLocaleUpperCase("hu-HU");
}

export function isSignable(text: string): boolean {
  return [...toSignCase(text)].every((char) => char === " " || glyphRows(char) !== null);
}

export type SignArt = { width: number; path: string };

const cache = new Map<string, SignArt>();

function layout(text: string): SignArt {
  const parts: string[] = [];
  let cursor = 0;
  for (const char of toSignCase(text)) {
    if (char === " ") {
      cursor += SPACE_ADVANCE;
      continue;
    }
    const rows = glyphRows(char);
    if (rows === null) {
      if (import.meta.env.DEV) {
        throw new Error(`Az Aknajel betűkészletben nincs „${char}” jel.`);
      }
      cursor += SPACE_ADVANCE;
      continue;
    }
    parts.push(pixelPath(rows, INK, cursor));
    cursor += ADVANCE;
  }
  return { width: Math.max(cursor - 1, 1), path: parts.join("") };
}

export function signArt(text: string): SignArt {
  const cached = cache.get(text);
  if (cached) {
    return cached;
  }
  const art = layout(text);
  cache.set(text, art);
  return art;
}
