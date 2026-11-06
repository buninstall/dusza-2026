import { describe, expect, test } from "bun:test";
import type { DiagCode, TokenKind } from "@minescript/engine";
import { classify, scanLine } from "../src/scanner.ts";

const line = (text: string) => ({ number: 1, text, offset: 0 });

const CLASSES: [string, TokenKind, boolean, DiagCode | null][] = [
  ["while", "keyword", false, null],
  ["isThere", "keyword", false, null],
  ["true", "bool", false, null],
  ["false", "bool", false, null],
  ["<=", "operator", false, null],
  ["<>", "operator", false, null],
  ["100", "number", false, null],
  ["0101", "number", false, "SYN_NUMBER_RANGE"],
  ["arany", "ident", false, null],
  ["a1B2", "ident", false, null],
  ["While", "ident", true, null],
  ["isthere", "ident", true, null],
  ["a_b", "invalid", false, "SYN_INVALID_IDENT"],
  ["árany", "invalid", false, "SYN_INVALID_IDENT"],
  ["_x", "invalid", false, "SYN_INVALID_IDENT"],
  ["1+2", "invalid", false, "SYN_INVALID_TOKEN"],
  ["-5", "invalid", false, "SYN_INVALID_TOKEN"],
  ["1a", "invalid", false, "SYN_INVALID_TOKEN"],
  ["(", "invalid", false, "SYN_INVALID_TOKEN"],
  ["==", "invalid", false, "SYN_INVALID_TOKEN"],
];

describe("classify", () => {
  test.each(CLASSES)("%s → %s", (text, kind, reserved, error) => {
    expect(classify(text, 3)).toEqual({ text, col: 3, kind, reserved, error });
  });
});

describe("scanLine", () => {
  test("a sorszintű hibák sorrendje: \\r, tab, üres sor", () => {
    expect(scanLine(line("\tx\r"))).toEqual({
      kind: "skipped",
      issue: { code: "SYN_LONE_CR", col: 3, length: 1 },
    });
    expect(scanLine(line(" \t "))).toEqual({
      kind: "skipped",
      issue: { code: "SYN_TAB", col: 2, length: 1 },
    });
    expect(scanLine(line("   "))).toEqual({
      kind: "skipped",
      issue: { code: "SYN_EMPTY_LINE", col: 1, length: 3 },
    });
    expect(scanLine(line(""))).toEqual({
      kind: "skipped",
      issue: { code: "SYN_EMPTY_LINE", col: 1, length: 0 },
    });
  });

  test("a behúzás és a tokenek oszlopa", () => {
    const scanned = scanLine(line("  print 1"));
    expect(scanned.kind).toBe("tokens");
    if (scanned.kind !== "tokens") return;
    expect(scanned.indent).toBe(2);
    expect(scanned.tokens.map((token) => [token.text, token.col])).toEqual([
      ["print", 3],
      ["1", 9],
    ]);
    expect(scanned.spacing).toEqual([]);
  });

  test("dupla szóköz a második szóköznél, sorvégi szóköz az első sorvégi szóköznél", () => {
    const scanned = scanLine(line("set   x to 1  "));
    if (scanned.kind !== "tokens") throw new Error("tokensor kell");
    expect(scanned.spacing).toEqual([
      { code: "SYN_DOUBLE_SPACE", col: 5, length: 2 },
      { code: "SYN_TRAILING_SPACE", col: 13, length: 2 },
    ]);
  });

  test("a nem törő szóköz a token része", () => {
    const scanned = scanLine(line("print 1"));
    if (scanned.kind !== "tokens") throw new Error("tokensor kell");
    expect(scanned.tokens).toHaveLength(1);
  });
});
