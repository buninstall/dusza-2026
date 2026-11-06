import { indentUnit } from "@codemirror/language";
import { EditorSelection, type Extension } from "@codemirror/state";
import { type Command, type EditorView, keymap } from "@codemirror/view";
import type { Engine, FormatResult } from "@minescript/engine";

export const INDENT = "    ";

export const insertSpacesTab: Command = (view) => {
  view.dispatch(
    view.state.changeByRange((range) => {
      const line = view.state.doc.lineAt(range.from);
      const column = range.from - line.from;
      const width = INDENT.length - (column % INDENT.length);
      return {
        changes: { from: range.from, to: range.to, insert: " ".repeat(width) },
        range: EditorSelection.cursor(range.from + width),
      };
    }),
  );
  return true;
};

export function formatDocument(engine: Engine, view: EditorView): FormatResult {
  const result = engine.format(view.state.doc.toString(), { indentWidth: INDENT.length });
  if (result.changed) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: result.text } });
  }
  return result;
}

export function mineScriptKeymap(
  engine: Engine,
  onFormat: (result: FormatResult) => void,
): Extension {
  const format: Command = (view) => {
    if (view.state.readOnly) {
      return false;
    }
    onFormat(formatDocument(engine, view));
    return true;
  };
  return [
    indentUnit.of(INDENT),
    keymap.of([
      { key: "Tab", run: insertSpacesTab },
      { key: "Shift-Alt-f", run: format, preventDefault: true },
    ]),
  ];
}
