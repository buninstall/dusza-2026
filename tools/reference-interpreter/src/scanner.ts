import type { DiagCode, TokenKind } from "@minescript/engine";
import { digitsValue, KEYWORDS, MAX_LITERAL, OPERATORS, type SourceLine } from "./source.ts";

export type ScannedToken = {
  text: string;
  col: number;
  kind: TokenKind;
  reserved: boolean;
  error: DiagCode | null;
};

export type LineIssue = { code: DiagCode; col: number; length: number };

export type ScannedLine =
  | { kind: "skipped"; issue: LineIssue }
  | { kind: "tokens"; indent: number; tokens: ScannedToken[]; spacing: LineIssue[] };

const KEYWORD_SET = new Set(KEYWORDS);
const RESERVED_SET = new Set(KEYWORDS.map((keyword) => keyword.toLowerCase()));
const OPERATOR_SET = new Set(OPERATORS);
const NUMBER_PATTERN = /^[0-9]+$/;
const IDENT_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const IDENT_LIKE_PATTERN = /^[\p{L}_]/u;

export function classify(text: string, col: number): ScannedToken {
  const base = { text, col, reserved: false, error: null };
  if (KEYWORD_SET.has(text)) {
    return { ...base, kind: text === "true" || text === "false" ? "bool" : "keyword" };
  }
  if (OPERATOR_SET.has(text)) return { ...base, kind: "operator" };
  if (NUMBER_PATTERN.test(text)) {
    return {
      ...base,
      kind: "number",
      error: digitsValue(text) > MAX_LITERAL ? "SYN_NUMBER_RANGE" : null,
    };
  }
  if (IDENT_PATTERN.test(text)) {
    return { ...base, kind: "ident", reserved: RESERVED_SET.has(text.toLowerCase()) };
  }
  return {
    ...base,
    kind: "invalid",
    error: IDENT_LIKE_PATTERN.test(text) ? "SYN_INVALID_IDENT" : "SYN_INVALID_TOKEN",
  };
}

function lineFault(text: string): LineIssue | null {
  const cr = text.indexOf("\r");
  if (cr >= 0) return { code: "SYN_LONE_CR", col: cr + 1, length: 1 };
  const tab = text.indexOf("\t");
  if (tab >= 0) return { code: "SYN_TAB", col: tab + 1, length: 1 };
  if (/^ *$/.test(text)) {
    return { code: "SYN_EMPTY_LINE", col: 1, length: text.length };
  }
  return null;
}

function countSpaces(text: string, from: number): number {
  let index = from;
  while (text[index] === " ") index += 1;
  return index - from;
}

export function scanLine(line: SourceLine): ScannedLine {
  const text = line.text;
  const fault = lineFault(text);
  if (fault) return { kind: "skipped", issue: fault };
  const indent = countSpaces(text, 0);
  const tokens: ScannedToken[] = [];
  const spacing: LineIssue[] = [];
  let index = indent;
  while (index < text.length) {
    const end = text.indexOf(" ", index);
    const tokenEnd = end < 0 ? text.length : end;
    tokens.push(classify(text.slice(index, tokenEnd), index + 1));
    const gap = countSpaces(text, tokenEnd);
    const next = tokenEnd + gap;
    if (gap > 0 && next >= text.length) {
      spacing.push({ code: "SYN_TRAILING_SPACE", col: tokenEnd + 1, length: gap });
    } else if (gap > 1) {
      spacing.push({ code: "SYN_DOUBLE_SPACE", col: tokenEnd + 2, length: gap - 1 });
    }
    index = next;
  }
  return { kind: "tokens", indent, tokens, spacing };
}
