import { describe, expect, test } from "bun:test";
import type { BinOp, Simple, Value } from "@minescript/engine";
import {
  evaluateBinary,
  evaluateNot,
  Fault,
  formatValue,
  readCondition,
  readCount,
  readSimple,
} from "../src/evaluate.ts";

const span = { line: 1, colStart: 1, colEnd: 2, from: 0, to: 1 };
const num = (value: number): Simple => ({ kind: "int", value, span });
const flag = (value: boolean): Simple => ({ kind: "bool", value, span });
const ident = (name: string): Simple => ({ kind: "ident", name, span });
const variables = new Map<string, Value>([
  ["big", { kind: "int", value: 9_007_199_254_740_991 }],
  ["neg", { kind: "int", value: -9_007_199_254_740_991 }],
  ["t", { kind: "bool", value: true }],
]);

function faultOf(action: () => unknown): string | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof Fault ? error.code : "egyéb";
  }
}

const binary = (op: BinOp, lhs: Simple, rhs: Simple) => evaluateBinary(op, lhs, rhs, variables);

describe("readSimple", () => {
  test("szám, logikai és változó", () => {
    expect(readSimple(num(3), variables)).toEqual({ kind: "int", value: 3 });
    expect(readSimple(flag(false), variables)).toEqual({ kind: "bool", value: false });
    expect(readSimple(ident("t"), variables)).toEqual({ kind: "bool", value: true });
    expect(faultOf(() => readSimple(ident("x"), variables))).toBe("E_UNINITIALIZED");
  });

  test("formatValue", () => {
    expect(formatValue({ kind: "int", value: -5 })).toBe("-5");
    expect(formatValue({ kind: "bool", value: true })).toBe("true");
  });
});

describe("evaluateBinary", () => {
  test.each<[BinOp, Simple, Simple, Value]>([
    ["add", num(2), num(3), { kind: "int", value: 5 }],
    ["sub", num(2), num(3), { kind: "int", value: -1 }],
    ["mul", num(4), num(3), { kind: "int", value: 12 }],
    ["eq", num(2), num(2), { kind: "bool", value: true }],
    ["ne", flag(true), flag(true), { kind: "bool", value: false }],
    ["lt", num(2), num(2), { kind: "bool", value: false }],
    ["le", num(2), num(2), { kind: "bool", value: true }],
    ["gt", num(3), num(2), { kind: "bool", value: true }],
    ["ge", num(1), num(2), { kind: "bool", value: false }],
    ["and", flag(true), flag(false), { kind: "bool", value: false }],
    ["or", flag(false), flag(true), { kind: "bool", value: true }],
  ])("%s", (op, lhs, rhs, expected) => {
    expect(binary(op, lhs, rhs)).toEqual(expected);
  });

  test("az operandusok típusa balról jobbra, beolvasás után azonnal", () => {
    expect(faultOf(() => binary("add", flag(true), ident("x")))).toBe("E_BAD_OPERAND");
    expect(faultOf(() => binary("and", num(1), ident("x")))).toBe("E_BAD_OPERAND");
    expect(faultOf(() => binary("or", flag(true), ident("x")))).toBe("E_UNINITIALIZED");
    expect(faultOf(() => binary("eq", ident("x"), num(1)))).toBe("E_UNINITIALIZED");
    expect(faultOf(() => binary("eq", num(1), flag(true)))).toBe("E_BAD_OPERAND");
    expect(faultOf(() => binary("lt", num(1), flag(true)))).toBe("E_BAD_OPERAND");
  });

  test("túlcsordulás a ±(2^53 − 1) határon túl", () => {
    expect(binary("add", ident("big"), num(0))).toEqual({
      kind: "int",
      value: 9_007_199_254_740_991,
    });
    expect(faultOf(() => binary("add", ident("big"), num(1)))).toBe("E_INT_OVERFLOW");
    expect(faultOf(() => binary("sub", ident("neg"), num(1)))).toBe("E_INT_OVERFLOW");
    expect(faultOf(() => binary("mul", ident("big"), ident("big")))).toBe("E_INT_OVERFLOW");
  });
});

describe("paraméterek és feltételek", () => {
  test("not csak logikaira", () => {
    expect(evaluateNot(flag(true), variables)).toEqual({ kind: "bool", value: false });
    expect(faultOf(() => evaluateNot(num(1), variables))).toBe("E_BAD_OPERAND");
  });

  test("readCount: nemnegatív egész", () => {
    expect(readCount(num(0), variables)).toBe(0);
    expect(faultOf(() => readCount(flag(true), variables))).toBe("E_BAD_ARG");
    expect(faultOf(() => readCount(ident("neg"), variables))).toBe("E_BAD_ARG");
    expect(faultOf(() => readCount(ident("x"), variables))).toBe("E_UNINITIALIZED");
  });

  test("readCondition: logikai", () => {
    expect(readCondition(ident("t"), variables)).toBe(true);
    expect(faultOf(() => readCondition(num(1), variables))).toBe("E_NON_BOOL_CONDITION");
  });

  test("a faultOf más hibát is jelez", () => {
    expect(
      faultOf(() => {
        throw new Error("x");
      }),
    ).toBe("egyéb");
  });
});
