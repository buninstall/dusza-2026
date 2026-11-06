import type { BinOp, DiagCode, Expr, Ident, Simple, StmtKind } from "@minescript/engine";
import type { LineIssue, ScannedToken } from "./scanner.ts";
import { digitsValue, type SourceLine, spanOf } from "./source.ts";

export type LineStmt =
  | Exclude<StmtKind, { kind: "if" } | { kind: "while" }>
  | { kind: "if"; cond: Simple }
  | { kind: "while"; cond: Simple }
  | { kind: "else" };

export type LineGrammar = { stmt: LineStmt | null; issue: LineIssue | null };

const BINARY_OPERATORS: ReadonlyMap<string, BinOp> = new Map([
  ["+", "add"],
  ["-", "sub"],
  ["*", "mul"],
  ["=", "eq"],
  ["<>", "ne"],
  ["<", "lt"],
  ["<=", "le"],
  [">", "gt"],
  [">=", "ge"],
  ["and", "and"],
  ["or", "or"],
]);

class GrammarFault {
  constructor(readonly issue: LineIssue) {}
}

type Cursor = { line: SourceLine; tokens: readonly ScannedToken[]; index: number };

function faultAt(code: DiagCode, token: ScannedToken): GrammarFault {
  return new GrammarFault({ code, col: token.col, length: token.text.length });
}

function take(cursor: Cursor): ScannedToken {
  const token = cursor.tokens[cursor.index];
  if (!token) {
    throw new GrammarFault({
      code: "SYN_MISSING_TOKEN",
      col: cursor.line.text.length + 1,
      length: 0,
    });
  }
  cursor.index += 1;
  return token;
}

function expectWord(cursor: Cursor, word: string): void {
  const token = take(cursor);
  if (token.text !== word) throw faultAt("SYN_UNEXPECTED_TOKEN", token);
}

function expectEnd(cursor: Cursor): void {
  const extra = cursor.tokens[cursor.index];
  if (extra) throw faultAt("SYN_EXTRA_TOKEN", extra);
}

function expectIdent(cursor: Cursor): Ident {
  const token = take(cursor);
  if (token.kind !== "ident") throw faultAt("SYN_UNEXPECTED_TOKEN", token);
  if (token.reserved) throw faultAt("SYN_RESERVED_IDENT", token);
  return { name: token.text, span: spanOf(cursor.line, token.col, token.text.length) };
}

function expectSimple(cursor: Cursor): Simple {
  const token = take(cursor);
  const span = spanOf(cursor.line, token.col, token.text.length);
  if (token.kind === "number") return { kind: "int", value: digitsValue(token.text), span };
  if (token.kind === "bool") return { kind: "bool", value: token.text === "true", span };
  if (token.kind !== "ident") throw faultAt("SYN_UNEXPECTED_TOKEN", token);
  if (token.reserved) throw faultAt("SYN_RESERVED_IDENT", token);
  return { kind: "ident", name: token.text, span };
}

function finish<T>(cursor: Cursor, value: T): T {
  expectEnd(cursor);
  return value;
}

function expression(cursor: Cursor): Expr {
  const first = cursor.tokens[cursor.index];
  if (first?.text === "isThere") {
    cursor.index += 1;
    return finish(cursor, { kind: "isThere", arg: expectSimple(cursor) });
  }
  if (first?.text === "not") {
    cursor.index += 1;
    return finish(cursor, { kind: "not", operand: expectSimple(cursor) });
  }
  const lhs = expectSimple(cursor);
  const operator = cursor.tokens[cursor.index];
  if (!operator) return { kind: "simple", value: lhs };
  const op = BINARY_OPERATORS.get(operator.text);
  if (!op) throw faultAt("SYN_UNEXPECTED_TOKEN", operator);
  cursor.index += 1;
  return finish(cursor, { kind: "binary", op, lhs, rhs: expectSimple(cursor) });
}

function statement(cursor: Cursor): LineStmt {
  const command = take(cursor);
  switch (command.text) {
    case "step":
      expectWord(cursor, "forward");
      return finish(cursor, { kind: "step", count: expectSimple(cursor) });
    case "turn":
      expectWord(cursor, "by");
      return finish(cursor, { kind: "turn", quarters: expectSimple(cursor) });
    case "mine":
      expectWord(cursor, "here");
      return finish(cursor, { kind: "mine" });
    case "print":
      return finish(cursor, { kind: "print", value: expectSimple(cursor) });
    case "if":
      return finish(cursor, { kind: "if", cond: expectSimple(cursor) });
    case "while":
      return finish(cursor, { kind: "while", cond: expectSimple(cursor) });
    case "else":
      return finish(cursor, { kind: "else" });
    case "set": {
      const name = expectIdent(cursor);
      expectWord(cursor, "to");
      return { kind: "set", name, value: expression(cursor) };
    }
    default:
      throw faultAt("SYN_UNKNOWN_COMMAND", command);
  }
}

type Candidate = { issue: LineIssue; rank: number };

function firstIssue(candidates: readonly Candidate[]): LineIssue | null {
  const sorted = [...candidates].sort((a, b) => a.issue.col - b.issue.col || a.rank - b.rank);
  return sorted[0]?.issue ?? null;
}

export function parseLineTokens(
  line: SourceLine,
  tokens: readonly ScannedToken[],
  spacing: readonly LineIssue[],
): LineGrammar {
  const candidates: Candidate[] = spacing.map((issue) => ({ issue, rank: 0 }));
  for (const token of tokens) {
    if (token.error) {
      candidates.push({
        issue: { code: token.error, col: token.col, length: token.text.length },
        rank: 0,
      });
    }
  }
  let stmt: LineStmt | null = null;
  try {
    stmt = statement({ line, tokens, index: 0 });
  } catch (fault) {
    if (!(fault instanceof GrammarFault)) throw fault;
    candidates.push({ issue: fault.issue, rank: 1 });
  }
  const issue = firstIssue(candidates);
  return { stmt: issue ? null : stmt, issue };
}
