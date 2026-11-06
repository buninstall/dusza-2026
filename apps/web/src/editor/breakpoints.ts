import {
  type EditorState,
  type Extension,
  RangeSet,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { EditorView, GutterMarker, gutter, keymap } from "@codemirror/view";

const toggleAt = StateEffect.define<number>();

class BreakpointMarker extends GutterMarker {
  override toDOM(): Node {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint";
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }
}

const marker = new BreakpointMarker();

function lineStarts(state: EditorState, set: RangeSet<GutterMarker>): number[] {
  const starts = new Set<number>();
  set.between(0, state.doc.length, (from) => {
    starts.add(state.doc.lineAt(from).from);
  });
  return [...starts].sort((a, b) => a - b);
}

export const breakpointField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(toggleAt)) {
        continue;
      }
      const start = transaction.state.doc.lineAt(effect.value).from;
      const isSet = lineStarts(transaction.state, next).includes(start);
      next = isSet
        ? next.update({ filter: (from) => transaction.state.doc.lineAt(from).from !== start })
        : next.update({ add: [marker.range(start)] });
    }
    return RangeSet.of(lineStarts(transaction.state, next).map((start) => marker.range(start)));
  },
});

export function breakpointLines(state: EditorState): number[] {
  const set = state.field(breakpointField, false);
  return set ? lineStarts(state, set).map((start) => state.doc.lineAt(start).number) : [];
}

export function toggleBreakpoint(view: EditorView, pos: number): number {
  view.dispatch({ effects: toggleAt.of(pos) });
  return view.state.doc.lineAt(pos).number;
}

type BreakpointOptions = {
  onChange: (lines: readonly number[]) => void;
  onKeyToggle: (line: number, isSet: boolean) => void;
};

function sameLines(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index]);
}

export function breakpoints(options: BreakpointOptions): Extension {
  return [
    breakpointField,
    gutter({
      class: "cm-breakpoint-gutter",
      markers: (view) => view.state.field(breakpointField),
      initialSpacer: () => marker,
      domEventHandlers: {
        mousedown: (view, line) => {
          toggleBreakpoint(view, line.from);
          return true;
        },
      },
    }),
    keymap.of([
      {
        key: "F9",
        run: (view) => {
          const line = toggleBreakpoint(view, view.state.selection.main.head);
          options.onKeyToggle(line, breakpointLines(view.state).includes(line));
          return true;
        },
      },
    ]),
    EditorView.updateListener.of((update) => {
      const before = breakpointLines(update.startState);
      const after = breakpointLines(update.state);
      if (!sameLines(before, after)) {
        options.onChange(after);
      }
    }),
  ];
}
