import {
  type EditorState,
  type Extension,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

export const setExecLine = StateEffect.define<number | null>();
export const setErrorLines = StateEffect.define<readonly number[]>();

type Marks = { exec: number | null; errors: readonly number[] };

const execDecoration = Decoration.line({
  class: "cm-exec-line",
  attributes: { "aria-current": "step" },
});
const errorDecoration = Decoration.line({ class: "cm-error-line" });

function build(state: EditorState, marks: Marks): DecorationSet {
  const lines = new Map<number, Decoration>();
  for (const line of marks.errors) {
    lines.set(line, errorDecoration);
  }
  if (marks.exec !== null) {
    lines.set(marks.exec, execDecoration);
  }
  const builder = new RangeSetBuilder<Decoration>();
  for (const number of [...lines.keys()].sort((a, b) => a - b)) {
    if (number >= 1 && number <= state.doc.lines) {
      const decoration = lines.get(number);
      if (decoration) {
        builder.add(state.doc.line(number).from, state.doc.line(number).from, decoration);
      }
    }
  }
  return builder.finish();
}

const marksField = StateField.define<{ marks: Marks; decorations: DecorationSet }>({
  create: () => ({ marks: { exec: null, errors: [] }, decorations: Decoration.none }),
  update(value, transaction) {
    let marks = value.marks;
    for (const effect of transaction.effects) {
      if (effect.is(setExecLine)) {
        marks = { ...marks, exec: effect.value };
      } else if (effect.is(setErrorLines)) {
        marks = { ...marks, errors: effect.value };
      }
    }
    if (marks === value.marks && !transaction.docChanged) {
      return value;
    }
    return { marks, decorations: build(transaction.state, marks) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

export function lineMarks(): Extension {
  return marksField;
}

export function scrollToLine(view: EditorView, line: number): void {
  if (line < 1 || line > view.state.doc.lines) {
    return;
  }
  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: "nearest" }),
  });
}
