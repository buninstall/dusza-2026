import type { BinOp, RuntimeErrorCode, Simple, Value } from "@minescript/engine";
import { MAX_INT } from "./source.ts";

export class Fault {
  constructor(readonly code: RuntimeErrorCode) {}
}

export type Variables = ReadonlyMap<string, Value>;

export function intValue(value: number): Value {
  return { kind: "int", value };
}

export function boolValue(value: boolean): Value {
  return { kind: "bool", value };
}

export function readSimple(simple: Simple, variables: Variables): Value {
  if (simple.kind === "int") return intValue(simple.value);
  if (simple.kind === "bool") return boolValue(simple.value);
  const value = variables.get(simple.name);
  if (!value) throw new Fault("E_UNINITIALIZED");
  return value;
}

export function formatValue(value: Value): string {
  return String(value.value);
}

const ARITHMETIC: ReadonlySet<BinOp> = new Set(["add", "sub", "mul"]);
const COMPARISON: ReadonlySet<BinOp> = new Set(["lt", "le", "gt", "ge"]);
const LOGIC: ReadonlySet<BinOp> = new Set(["and", "or"]);

function expectedKind(op: BinOp): Value["kind"] | null {
  if (ARITHMETIC.has(op) || COMPARISON.has(op)) return "int";
  return LOGIC.has(op) ? "bool" : null;
}

function checked(result: bigint): Value {
  if (result > MAX_INT || result < -MAX_INT) throw new Fault("E_INT_OVERFLOW");
  return intValue(Number(result));
}

function arithmetic(op: BinOp, lhs: number, rhs: number): Value {
  const a = BigInt(lhs);
  const b = BigInt(rhs);
  if (op === "add") return checked(a + b);
  if (op === "sub") return checked(a - b);
  return checked(a * b);
}

function compare(op: BinOp, lhs: number, rhs: number): boolean {
  if (op === "lt") return lhs < rhs;
  if (op === "le") return lhs <= rhs;
  if (op === "gt") return lhs > rhs;
  return lhs >= rhs;
}

function compute(op: BinOp, lhs: Value, rhs: Value): Value {
  if (op === "eq") return boolValue(lhs.value === rhs.value);
  if (op === "ne") return boolValue(lhs.value !== rhs.value);
  if (op === "and") return boolValue(lhs.value === true && rhs.value === true);
  if (op === "or") return boolValue(lhs.value === true || rhs.value === true);
  const a = Number(lhs.value);
  const b = Number(rhs.value);
  return ARITHMETIC.has(op) ? arithmetic(op, a, b) : boolValue(compare(op, a, b));
}

export function evaluateBinary(op: BinOp, lhs: Simple, rhs: Simple, variables: Variables): Value {
  const expected = expectedKind(op);
  const left = readSimple(lhs, variables);
  if (expected && left.kind !== expected) throw new Fault("E_BAD_OPERAND");
  const right = readSimple(rhs, variables);
  if (right.kind !== (expected ?? left.kind)) throw new Fault("E_BAD_OPERAND");
  return compute(op, left, right);
}

export function evaluateNot(operand: Simple, variables: Variables): Value {
  const value = readSimple(operand, variables);
  if (value.kind !== "bool") throw new Fault("E_BAD_OPERAND");
  return boolValue(!value.value);
}

export function readCount(simple: Simple, variables: Variables): number {
  const value = readSimple(simple, variables);
  if (value.kind !== "int" || value.value < 0) throw new Fault("E_BAD_ARG");
  return value.value;
}

export function readCondition(simple: Simple, variables: Variables): boolean {
  const value = readSimple(simple, variables);
  if (value.kind !== "bool") throw new Fault("E_NON_BOOL_CONDITION");
  return value.value;
}
