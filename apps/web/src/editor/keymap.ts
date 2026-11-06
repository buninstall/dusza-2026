import { indentUnit } from "@codemirror/language";
import { EditorSelection, type Extension } from "@codemirror/state";
import { type Command, keymap } from "@codemirror/view";
import type { Engine } from "@minescript/engine";

export const INDENT = "    ";

export const insertSpacesTab: Command = (view) => {
  view.dispatch(
    view.state.changeByRange((range) => {
      const line = view.state.doc.lineAt(range.from);
      const column = range.from - line.from;
      const width = INDENT.length - (column % INDENT.length);
      const insert = " ".repeat(width);
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + width),
      };
    }),
  );
  return true;
};

export function formatCommand(engine: Engine): Command {
  return (view) => {
    const result = engine.format(view.state.doc.toString(), { indentWidth: INDENT.length });
    if (result.changed) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: result.text },
      });
    }
    return true;
  };
}

export function mineScriptKeymap(engine: Engine): Extension {
  return [
    indentUnit.of(INDENT),
    keymap.of([
      { key: "Tab", run: insertSpacesTab },
      { key: "Shift-Alt-f", run: formatCommand(engine), preventDefault: true },
    ]),
  ];
}
