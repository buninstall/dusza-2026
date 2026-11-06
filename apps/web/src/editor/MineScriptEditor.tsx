import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { lintKeymap } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightTrailingWhitespace,
  highlightWhitespace,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import type { Diagnostic } from "@minescript/engine";
import { useEffect, useRef } from "react";
import { useEngine } from "../engine/useEngine.ts";
import { mineScriptCompletion } from "./completion.ts";
import { lineMarks, scrollToLine, setErrorLines, setExecLine } from "./exec-line.ts";
import { mineScriptHover } from "./hover.ts";
import { mineScriptKeymap } from "./keymap.ts";
import { mineScriptHighlighting, mineScriptLanguage } from "./language.ts";
import { mineScriptLinter } from "./lint.ts";

type MineScriptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  describedBy?: string;
  execLine?: number | null;
  errorLines?: readonly number[];
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
};

const NO_LINES: readonly number[] = [];

export function MineScriptEditor({
  value,
  onChange,
  label,
  describedBy,
  execLine = null,
  errorLines = NO_LINES,
  onDiagnostics,
}: MineScriptEditorProps) {
  const engine = useEngine();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValue = useRef(value);
  const callbacks = useRef({ onChange, onDiagnostics });
  callbacks.current = { onChange, onDiagnostics };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          highlightWhitespace(),
          highlightTrailingWhitespace(),
          mineScriptLanguage(engine.keywords()),
          mineScriptHighlighting(),
          mineScriptLinter(engine, (diagnostics) => callbacks.current.onDiagnostics?.(diagnostics)),
          mineScriptCompletion(engine),
          mineScriptHover(engine),
          lineMarks(),
          mineScriptKeymap(engine),
          keymap.of([...defaultKeymap, ...historyKeymap, ...lintKeymap]),
          EditorView.contentAttributes.of({
            "aria-label": label,
            ...(describedBy ? { "aria-describedby": describedBy } : {}),
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              callbacks.current.onChange(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [engine, label, describedBy]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({ effects: setExecLine.of(execLine) });
    if (execLine !== null) {
      scrollToLine(view, execLine);
    }
  }, [execLine]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLines.of(errorLines) });
  }, [errorLines]);

  return <div ref={hostRef} className="h-full min-h-72" />;
}
