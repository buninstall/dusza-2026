import { type IndentContext, indentOnInput, indentService } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { INDENT } from "./keymap.ts";

const HEADER = /^(if|while|else)(\s|$)/;
const ELSE = /^else(\s|$)/;
const BRANCH = /^(if|else)(\s|$)/;

function leadingSpaces(text: string): number {
  return text.length - text.trimStart().length;
}

function* linesAbove(cx: IndentContext, pos: number): Generator<string> {
  let at = cx.simulatedBreak === pos ? pos : cx.lineAt(pos, 1).from - 1;
  while (at >= 0) {
    const line = cx.lineAt(at, -1);
    yield line.text;
    at = line.from - 1;
  }
}

function previousCode(cx: IndentContext, pos: number): string | null {
  for (const text of linesAbove(cx, pos)) {
    if (text.trim() !== "") {
      return text;
    }
  }
  return null;
}

function elseIndent(cx: IndentContext, pos: number, base: number): number {
  for (const text of linesAbove(cx, pos)) {
    const depth = leadingSpaces(text);
    if (BRANCH.test(text.trimStart()) && depth < base) {
      return depth;
    }
  }
  return Math.max(0, base - INDENT.length);
}

export function blockIndent(cx: IndentContext, pos: number): number {
  const previous = previousCode(cx, pos);
  if (previous === null) {
    return 0;
  }
  const depth = leadingSpaces(previous);
  const base = HEADER.test(previous.trimStart()) ? depth + INDENT.length : depth;
  return ELSE.test(cx.textAfterPos(pos).trimStart()) ? elseIndent(cx, pos, base) : base;
}

export function mineScriptIndent(): Extension {
  return [indentService.of(blockIndent), indentOnInput()];
}
