import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { lintKeymap } from "@codemirror/lint";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
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
import type { Diagnostic, FormatResult } from "@minescript/engine";
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import { useEngine } from "../engine/useEngine.ts";
import { mineScriptCompletion } from "./completion.ts";
import "./MineScriptEditor.css";
import { lineMarks, scrollToLine, setErrorLines, setExecLine } from "./exec-line.ts";
import { mineScriptHover } from "./hover.ts";
import { formatDocument, mineScriptKeymap } from "./keymap.ts";
import { mineScriptHighlighting, mineScriptLanguage } from "./language.ts";
import { mineScriptLinter } from "./lint.ts";

export type EditorHandle = {
  reveal: (from: number, to: number) => void;
  revealLine: (line: number) => void;
  format: () => FormatResult | null;
};

type MineScriptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  describedBy?: string;
  execLine?: number | null;
  errorLines?: readonly number[];
  isReadOnly?: boolean;
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
  onFormat?: (result: FormatResult) => void;
  ref?: Ref<EditorHandle>;
};

const NO_LINES: readonly number[] = [];

function readOnlyExtension(isReadOnly: boolean) {
  return [
    EditorState.readOnly.of(isReadOnly),
    EditorView.contentAttributes.of({ "aria-readonly": String(isReadOnly) }),
  ];
}

export function MineScriptEditor({
  value,
  onChange,
  label,
  describedBy,
  execLine = null,
  errorLines = NO_LINES,
  isReadOnly = false,
  onDiagnostics,
  onFormat,
  ref,
}: MineScriptEditorProps) {
  const engine = useEngine();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnly = useRef(new Compartment());
  const initial = useRef({ value, isReadOnly });
  const callbacks = useRef({ onChange, onDiagnostics, onFormat });
  callbacks.current = { onChange, onDiagnostics, onFormat };

  useImperativeHandle(ref, () => {
    const reveal = (from: number, to: number) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      const end = Math.min(to, view.state.doc.length);
      const start = Math.min(from, end);
      view.dispatch({
        selection: EditorSelection.range(start, end),
        effects: EditorView.scrollIntoView(start, { y: "center" }),
      });
      view.focus();
    };
    return {
      reveal,
      revealLine(line) {
        const doc = viewRef.current?.state.doc;
        if (doc && line >= 1 && line <= doc.lines) {
          const target = doc.line(line);
          reveal(target.from, target.to);
        }
      },
      format() {
        const view = viewRef.current;
        return view && !view.state.readOnly ? formatDocument(engine, view) : null;
      },
    };
  }, [engine]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initial.current.value,
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
          mineScriptKeymap(engine, (result) => callbacks.current.onFormat?.(result)),
          keymap.of([...defaultKeymap, ...historyKeymap, ...lintKeymap]),
          readOnly.current.of(readOnlyExtension(initial.current.isReadOnly)),
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
    viewRef.current?.dispatch({
      effects: readOnly.current.reconfigure(readOnlyExtension(isReadOnly)),
    });
  }, [isReadOnly]);

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

  return <div ref={hostRef} className="code-host" data-readonly={isReadOnly} />;
}
