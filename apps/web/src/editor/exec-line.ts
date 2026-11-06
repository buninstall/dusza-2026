import { forEachDiagnostic } from "@codemirror/lint";
import {
  type EditorState,
  type Extension,
  type RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, GutterMarker, gutter } from "@codemirror/view";

export type RuntimeMark = { line: number; text: string };

export const setExecLine = StateEffect.define<number | null>();
export const setErrorLines = StateEffect.define<readonly number[]>();
export const setRuntimeMark = StateEffect.define<RuntimeMark | null>();

type Marks = { exec: number | null; errors: readonly number[]; runtime: RuntimeMark | null };

const execDecoration = Decoration.line({
  class: "cm-exec-line",
  attributes: { "aria-current": "step" },
});
const errorDecoration = Decoration.line({ class: "cm-error-line" });
const runtimeDecoration = Decoration.line({ class: "cm-runtime-line" });

function decorationFor(marks: Marks, line: number): Decoration | null {
  if (marks.runtime?.line === line) {
    return runtimeDecoration;
  }
  if (marks.errors.includes(line)) {
    return errorDecoration;
  }
  return marks.exec === line ? execDecoration : null;
}

function build(state: EditorState, marks: Marks): DecorationSet {
  const lines = new Set<number>(marks.errors);
  if (marks.exec !== null) {
    lines.add(marks.exec);
  }
  if (marks.runtime) {
    lines.add(marks.runtime.line);
  }
  const builder = new RangeSetBuilder<Decoration>();
  for (const number of [...lines].sort((a, b) => a - b)) {
    const decoration = decorationFor(marks, number);
    if (decoration && number >= 1 && number <= state.doc.lines) {
      const from = state.doc.line(number).from;
      builder.add(from, from, decoration);
    }
  }
  return builder.finish();
}

const EMPTY_MARKS: Marks = { exec: null, errors: [], runtime: null };

const marksField = StateField.define<{ marks: Marks; decorations: DecorationSet }>({
  create: () => ({ marks: EMPTY_MARKS, decorations: Decoration.none }),
  update(value, transaction) {
    let marks = value.marks;
    for (const effect of transaction.effects) {
      if (effect.is(setExecLine)) {
        marks = { ...marks, exec: effect.value };
      } else if (effect.is(setErrorLines)) {
        marks = { ...marks, errors: effect.value };
      } else if (effect.is(setRuntimeMark)) {
        marks = { ...marks, runtime: effect.value };
      }
    }
    if (marks === value.marks && !transaction.docChanged) {
      return value;
    }
    return { marks, decorations: build(transaction.state, marks) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

export const runtimeMarkField = StateField.define<RuntimeMark | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setRuntimeMark)) {
        return effect.value;
      }
    }
    return value;
  },
});

class FaultMarker extends GutterMarker {
  constructor(readonly kind: "exec" | "error" | "warning") {
    super();
  }

  override eq(other: FaultMarker): boolean {
    return other.kind === this.kind;
  }

  override toDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = "cm-fault-marker";
    element.dataset.kind = this.kind;
    return element;
  }
}

const MARKERS = {
  exec: new FaultMarker("exec"),
  error: new FaultMarker("error"),
  warning: new FaultMarker("warning"),
};

function lineKinds(state: EditorState): Map<number, "exec" | "error" | "warning"> {
  const kinds = new Map<number, "exec" | "error" | "warning">();
  forEachDiagnostic(state, (diagnostic, from) => {
    const line = state.doc.lineAt(from).number;
    if (diagnostic.severity === "error") {
      kinds.set(line, "error");
    } else if (!kinds.has(line)) {
      kinds.set(line, "warning");
    }
  });
  const exec = state.field(marksField).marks.exec;
  if (exec !== null && exec >= 1 && exec <= state.doc.lines) {
    kinds.set(exec, "exec");
  }
  return kinds;
}

function faultMarkers(state: EditorState): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  const kinds = lineKinds(state);
  for (const line of [...kinds.keys()].sort((a, b) => a - b)) {
    const kind = kinds.get(line);
    if (kind) {
      const from = state.doc.line(line).from;
      builder.add(from, from, MARKERS[kind]);
    }
  }
  return builder.finish();
}

export function lineMarks(): Extension {
  return [
    marksField,
    runtimeMarkField,
    gutter({
      class: "cm-gutter-fault",
      markers: (view) => faultMarkers(view.state),
      initialSpacer: () => MARKERS.error,
    }),
  ];
}

export function scrollToLine(view: EditorView, line: number): void {
  if (line < 1 || line > view.state.doc.lines) {
    return;
  }
  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: "nearest" }),
  });
}
