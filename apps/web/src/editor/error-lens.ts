import { forEachDiagnostic } from "@codemirror/lint";
import { type EditorState, type Extension, RangeSetBuilder, StateEffect } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { DiagCode } from "@minescript/engine";
import { diagnosticTitles } from "../i18n/hu.ts";
import { runtimeMarkField } from "./exec-line.ts";

export const LENS_LIMIT = 200;
const IDLE_MS = 1500;
const LENS_MARK = "◂";

const lensTick = StateEffect.define<null>();

function titleOf(code: string): string {
  return diagnosticTitles[code as DiagCode] ?? code;
}

function errorLines(state: EditorState): Map<number, string> {
  const lines = new Map<number, string>();
  forEachDiagnostic(state, (diagnostic, from) => {
    if (diagnostic.severity !== "error" || lines.size >= LENS_LIMIT) {
      return;
    }
    const line = state.doc.lineAt(from).number;
    if (!lines.has(line)) {
      lines.set(line, titleOf(diagnostic.source ?? ""));
    }
  });
  return lines;
}

function buildLenses(view: EditorView, quietLine: number | null): DecorationSet {
  const { state } = view;
  const lines = errorLines(state);
  const runtime = state.field(runtimeMarkField, false);
  if (runtime && runtime.line >= 1 && runtime.line <= state.doc.lines) {
    lines.set(runtime.line, runtime.text);
  }
  const builder = new RangeSetBuilder<Decoration>();
  for (const number of [...lines.keys()].sort((a, b) => a - b)) {
    if (number === quietLine || number > state.doc.lines) {
      continue;
    }
    const text = lines.get(number) ?? "";
    const start = state.doc.line(number).from;
    builder.add(
      start,
      start,
      Decoration.line({ class: "cm-lens-line", attributes: { "data-lens": `${LENS_MARK} ${text}` } }),
    );
  }
  return builder.finish();
}

function cursorLine(state: EditorState): number {
  return state.doc.lineAt(state.selection.main.head).number;
}

const lensPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private quietLine: number | null = null;
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(readonly view: EditorView) {
      this.decorations = buildLenses(view, null);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.quietLine = cursorLine(update.state);
        this.schedule();
      } else if (update.selectionSet && this.quietLine !== cursorLine(update.state)) {
        this.quietLine = null;
      }
      if (update.transactions.some((tr) => tr.effects.some((effect) => effect.is(lensTick)))) {
        this.quietLine = null;
      }
      this.decorations = buildLenses(update.view, this.quietLine);
    }

    private schedule() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.view.dispatch({ effects: lensTick.of(null) }), IDLE_MS);
    }

    destroy() {
      clearTimeout(this.timer);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export function errorLens(): Extension {
  return lensPlugin;
}
