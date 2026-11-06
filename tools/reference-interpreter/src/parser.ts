import type { DiagCode, Diagnostic, ParseResult, Span, Stmt } from "@minescript/engine";
import { type LineStmt, parseLineTokens } from "./grammar.ts";
import { diagnosticMessage } from "./messages.ts";
import { type LineIssue, scanLine } from "./scanner.ts";
import { COMMANDS, type SourceLine, spanOf, splitLines } from "./source.ts";

export type SyntaxIssue = { code: DiagCode; line: number; col: number };

type Frame = {
  indent: number;
  depth: number;
  parent: Frame | null;
  last: { isIf: boolean; hasElse: boolean } | null;
};

type Analyzed = { line: SourceLine; indent: number; depth: number; stmt: LineStmt | null };

type Pending = { line: SourceLine; indent: number; first: string; stmt: LineStmt | null };

const HEADERS = new Set(["if", "while", "else"]);

function diagnostic(line: SourceLine, issue: LineIssue, help: string | null = null): Diagnostic {
  return {
    code: issue.code,
    severity: "error",
    span: spanOf(line, issue.col, issue.length),
    message: diagnosticMessage(issue.code),
    help,
    fixes: [],
  };
}

function commandHelp(word: string): string | null {
  const match = COMMANDS.find((command) => command.toLowerCase() === word.toLowerCase());
  return match ? `Talán erre gondoltál: ${match}` : null;
}

function deeperIssue(current: Frame, first: boolean): DiagCode {
  if (first) return "SYN_TOPLEVEL_INDENT";
  return current.parent ? "SYN_INCONSISTENT_INDENT" : "SYN_UNEXPECTED_INDENT";
}

function placeLine(
  current: Frame,
  entry: Pending,
  opensBlock: boolean,
  first: boolean,
): { frame: Frame; issue: DiagCode | null } {
  if (entry.indent > current.indent) {
    if (!opensBlock) return { frame: current, issue: deeperIssue(current, first) };
    return {
      frame: { indent: entry.indent, depth: current.depth + 1, parent: current, last: null },
      issue: null,
    };
  }
  let frame = current;
  while (frame.parent && frame.indent > entry.indent) frame = frame.parent;
  return { frame, issue: frame.indent === entry.indent ? null : "SYN_DEDENT_MISMATCH" };
}

function attachElse(frame: Frame): boolean {
  const ok = frame.last?.isIf === true && !frame.last.hasElse;
  frame.last = { isIf: ok, hasElse: ok };
  return ok;
}

function layout(entries: readonly Pending[], diagnostics: Diagnostic[]): Analyzed[] {
  const analyzed: Analyzed[] = [];
  let frame: Frame = { indent: 0, depth: 0, parent: null, last: null };
  let previousHeader = false;
  entries.forEach((entry, index) => {
    const placed = placeLine(frame, entry, previousHeader, index === 0);
    frame = placed.frame;
    let issue = placed.issue;
    if (entry.first === "else") {
      if (!attachElse(frame) && !issue) issue = "SYN_ELSE_WITHOUT_IF";
    } else {
      frame.last = { isIf: entry.first === "if", hasElse: false };
    }
    if (issue) {
      const col = issue === "SYN_ELSE_WITHOUT_IF" ? entry.indent + 1 : 1;
      const length = issue === "SYN_ELSE_WITHOUT_IF" ? 4 : Math.max(entry.indent, 1);
      diagnostics.push(diagnostic(entry.line, { code: issue, col, length }));
    }
    previousHeader = HEADERS.has(entry.first);
    analyzed.push({ line: entry.line, indent: entry.indent, depth: frame.depth, stmt: entry.stmt });
  });
  return analyzed;
}

function statementSpan(entry: Analyzed): Span {
  return spanOf(entry.line, entry.indent + 1, entry.line.text.length - entry.indent);
}

type Builder = { lines: readonly Analyzed[]; index: number };

function buildBlock(builder: Builder, depth: number): Stmt[] {
  const body: Stmt[] = [];
  let entry = builder.lines[builder.index];
  while (entry?.stmt && entry.depth === depth && entry.stmt.kind !== "else") {
    builder.index += 1;
    body.push(buildStmt(builder, entry, entry.stmt, depth));
    entry = builder.lines[builder.index];
  }
  return body;
}

function buildStmt(
  builder: Builder,
  entry: Analyzed,
  stmt: Exclude<LineStmt, { kind: "else" }>,
  depth: number,
): Stmt {
  const base = { line: entry.line.number, span: statementSpan(entry) };
  if (stmt.kind === "while") {
    return {
      ...base,
      kind: { kind: "while", cond: stmt.cond, body: buildBlock(builder, depth + 1) },
    };
  }
  if (stmt.kind !== "if") return { ...base, kind: stmt };
  const thenBody = buildBlock(builder, depth + 1);
  const next = builder.lines[builder.index];
  if (next?.depth !== depth || next.stmt?.kind !== "else") {
    return { ...base, kind: { kind: "if", cond: stmt.cond, thenBody, elseBranch: null } };
  }
  builder.index += 1;
  const elseBranch = {
    line: next.line.number,
    span: statementSpan(next),
    body: buildBlock(builder, depth + 1),
  };
  return { ...base, kind: { kind: "if", cond: stmt.cond, thenBody, elseBranch } };
}

function byPosition(a: Diagnostic, b: Diagnostic): number {
  return a.span.line - b.span.line || a.span.colStart - b.span.colStart;
}

export function parse(src: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const entries: Pending[] = [];
  for (const line of splitLines(src)) {
    const scanned = scanLine(line);
    if (scanned.kind === "skipped") {
      diagnostics.push(diagnostic(line, scanned.issue));
      continue;
    }
    const grammar = parseLineTokens(line, scanned.tokens, scanned.spacing);
    const first = scanned.tokens[0]?.text ?? "";
    if (grammar.issue) {
      const help = grammar.issue.code === "SYN_UNKNOWN_COMMAND" ? commandHelp(first) : null;
      diagnostics.push(diagnostic(line, grammar.issue, help));
    }
    entries.push({ line, indent: scanned.indent, first, stmt: grammar.stmt });
  }
  const analyzed = layout(entries, diagnostics);
  diagnostics.sort(byPosition);
  if (diagnostics.length > 0) return { program: null, diagnostics };
  return { program: { body: buildBlock({ lines: analyzed, index: 0 }, 0) }, diagnostics };
}

export function check(src: string): { valid: boolean; diagnostics: SyntaxIssue[] } {
  const { diagnostics } = parse(src);
  return {
    valid: diagnostics.length === 0,
    diagnostics: diagnostics.map((d) => ({
      code: d.code,
      line: d.span.line,
      col: d.span.colStart,
    })),
  };
}
