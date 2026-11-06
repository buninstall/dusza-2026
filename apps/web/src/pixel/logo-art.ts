import { type PixelRows, sprite, TRANSPARENT } from "./pixel-art.ts";

const MARK_ART: PixelRows = [
  "......kLLk......",
  ".......kk.......",
  "...kkkkkkkkkk...",
  "..keeeeeeeeaak..",
  "..keaaaaaaaadk..",
  "..kkkkkkkkkkkk..",
  "..kvvkkkkkkvvk..",
  "..kvvkkkkkkvvk..",
  "..kkkkkkkkkkkk..",
  "..kaaaaaaaaadk..",
  "..kaakkkkkkadk..",
  "..kaaaaaaaaddk..",
  "...kkkkkkkkkk...",
  ".....kttttk.oyo.",
  "...kkkkkkkkoggbo",
  "...........oobo.",
];

export const MARK_TONES = {
  k: "steel-edge",
  e: "steel-hi",
  a: "steel",
  d: "steel-lo",
  t: "tread",
  v: "visor",
  L: "lamp",
  o: "ore-edge",
  g: "ore",
  y: "ore-hi",
  b: "ore-lo",
} as const;

export const LOGO_MARK = sprite(MARK_ART, MARK_TONES);

export const MARK_ROWS = MARK_ART;

const WORD_HEIGHT = 10;

const LETTERS: Readonly<Record<string, PixelRows>> = {
  M: [
    "##....##",
    "###..###",
    "##.##.##",
    "##.##.##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
  ],
  i: ["##", "..", "##", "##", "##", "##", "##", "##"],
  n: ["......", "......", "#####.", "##..##", "##..##", "##..##", "##..##", "##..##"],
  e: ["......", "......", ".####.", "##..##", "######", "##....", "##....", ".#####"],
  S: [".#####", "##....", "##....", ".####.", "....##", "....##", "....##", "#####."],
  c: [".....", ".....", ".####", "##...", "##...", "##...", "##...", ".####"],
  r: [".....", ".....", "##.##", "####.", "##...", "##...", "##...", "##..."],
  p: [
    "......",
    "......",
    "#####.",
    "##..##",
    "##..##",
    "##..##",
    "##..##",
    "#####.",
    "##....",
    "##....",
  ],
  t: ["##..", "##..", "####", "##..", "##..", "##..", "##..", ".###"],
};

function padRows(rows: PixelRows): PixelRows {
  const width = rows[0]?.length ?? 0;
  const blank = TRANSPARENT.repeat(width);
  return Array.from({ length: WORD_HEIGHT }, (_, index) => rows[index] ?? blank);
}

function wordRows(word: string, symbol: string): string[] {
  const glyphs = [...word].map((letter) => padRows(LETTERS[letter] ?? []));
  return Array.from({ length: WORD_HEIGHT }, (_, row) =>
    glyphs.map((glyph) => (glyph[row] ?? "").replaceAll("#", symbol)).join(TRANSPARENT),
  );
}

function besides(left: PixelRows, right: PixelRows): string[] {
  return left.map((row, index) => `${row}${TRANSPARENT}${right[index] ?? ""}`);
}

export const WORDMARK_ROWS: PixelRows = besides(wordRows("Mine", "w"), wordRows("Script", "g"));

export const WORDMARK_TONES = { w: "ink", g: "ink-gold" } as const;

export const WORDMARK_ART = sprite(WORDMARK_ROWS, WORDMARK_TONES);

export const LOCKUP_WIDTH = 80;
export const LOCKUP_HEIGHT = 16;
export const WORDMARK_X = 20;
export const WORDMARK_Y = (LOCKUP_HEIGHT - WORD_HEIGHT) / 2;
