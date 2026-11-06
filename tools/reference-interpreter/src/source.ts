import type { Span } from "@minescript/engine";

export const KEYWORDS: readonly string[] = [
  "and",
  "by",
  "else",
  "false",
  "forward",
  "here",
  "if",
  "isThere",
  "mine",
  "not",
  "or",
  "print",
  "set",
  "step",
  "to",
  "true",
  "turn",
  "while",
];

export const COMMANDS: readonly string[] = [
  "step",
  "turn",
  "mine",
  "print",
  "set",
  "if",
  "else",
  "while",
];

export const OPERATORS: readonly string[] = ["+", "-", "*", "=", "<>", "<", "<=", ">", ">="];

export const MAX_LITERAL = 100;
export const STEP_LIMIT = 1000;
export const MAX_INT = 9_007_199_254_740_991n;
export const MAX_MAP_SIZE = 15;

export type SourceLine = { number: number; text: string; offset: number };

const BOM = String.fromCharCode(0xfeff);

export function normalize(text: string): string {
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  return withoutBom.replaceAll("\r\n", "\n");
}

export function splitLines(text: string): SourceLine[] {
  const normalized = normalize(text);
  const body = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  if (body === "") return [];
  const lines: SourceLine[] = [];
  let offset = 0;
  body.split("\n").forEach((lineText, index) => {
    lines.push({ number: index + 1, text: lineText, offset });
    offset += lineText.length + 1;
  });
  return lines;
}

export function spanOf(line: SourceLine, col: number, length: number): Span {
  const from = line.offset + col - 1;
  return { line: line.number, colStart: col, colEnd: col + length, from, to: from + length };
}

export function digitsValue(digits: string): number {
  const significant = digits.replace(/^0+/, "");
  if (significant.length > 6) return Number.POSITIVE_INFINITY;
  return Number(significant === "" ? "0" : significant);
}
