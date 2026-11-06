import { snippet } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { nextDiagnostic, previousDiagnostic } from "@codemirror/lint";
import { Compartment, EditorSelection, EditorState, Prec } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightTrailingWhitespace,
  highlightWhitespace,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
} from "@codemirror/view";
import type { FormatResult, TextEdit } from "@minescript/engine";
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import { useEngine } from "../engine/useEngine.ts";
import { useKeyboardFocusRing } from "../lib/input-modality.ts";
import { breakpoints, toggleBreakpoint } from "./breakpoints.ts";
import { mineScriptCompletion } from "./completion.ts";
import { errorLens } from "./error-lens.ts";
import "./MineScriptEditor.css";
import {
  lineMarks,
  type RuntimeMark,
  scrollToLine,
  setErrorLines,
  setExecLine,
  setRuntimeMark,
} from "./exec-line.ts";
import { mineScriptHover } from "./hover.ts";
import { type InsertableBlock, planInsertion } from "./insertion.ts";
import { formatDocument, mineScriptKeymap } from "./keymap.ts";
import { mineScriptHighlighting, mineScriptLanguage } from "./language.ts";
import { type LintReport, mineScriptLinter } from "./lint.ts";

export type InsertedRange = { firstLine: number; lastLine: number };

export type EditorHandle = {
  reveal: (from: number, to: number) => void;
  revealLine: (line: number) => void;
  format: () => FormatResult | null;
  insertBlock: (block: InsertableBlock) => InsertedRange | null;
  insertBeforeLine: (line: number, block: InsertableBlock) => InsertedRange | null;
  focus: () => void;
  applyEdits: (edits: readonly TextEdit[]) => void;
};

export type EditorCommands = { onToggleFaults?: () => void };

type MineScriptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  describedBy?: string;
  placeholder?: string;
  execLine?: number | null;
  errorLines?: readonly number[];
  runtimeMark?: RuntimeMark | null;
  isReadOnly?: boolean;
  onLint?: (report: LintReport) => void;
  onFormat?: (result: FormatResult) => void;
  onBreakpointsChange?: (lines: readonly number[]) => void;
  onBreakpointKey?: (line: number, isSet: boolean) => void;
  commands?: EditorCommands;
  ref?: Ref<EditorHandle>;
};

const NO_LINES: readonly number[] = [];

function readOnlyExtension(isReadOnly: boolean) {
  return [
    EditorState.readOnly.of(isReadOnly),
    EditorView.contentAttributes.of({ "aria-readonly": String(isReadOnly) }),
  ];
}

function insertInto(
  view: EditorView,
  block: InsertableBlock,
  cursor: number,
): InsertedRange | null {
  if (view.state.readOnly) {
    return null;
  }
  const plan = planInsertion(view.state.doc.toString(), cursor, block);
  if (plan.snippet) {
    snippet(plan.snippet.template)(view, null, plan.snippet.from, plan.snippet.to);
  } else {
    view.dispatch({
      changes: { from: plan.from, to: plan.to, insert: plan.text },
      selection: EditorSelection.cursor(plan.cursor),
      userEvent: "input.block",
      scrollIntoView: true,
    });
  }
  view.focus();
  return { firstLine: plan.firstLine, lastLine: plan.lastLine };
}

export function MineScriptEditor({
  value,
  onChange,
  label,
  describedBy,
  placeholder,
  execLine = null,
  errorLines = NO_LINES,
  runtimeMark = null,
  isReadOnly = false,
  onLint,
  onFormat,
  onBreakpointsChange,
  onBreakpointKey,
  commands,
  ref,
}: MineScriptEditorProps) {
  const engine = useEngine();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnly = useRef(new Compartment());
  const initial = useRef({
    value,
    isReadOnly,
    placeholder,
    hasBreakpoints: onBreakpointsChange !== undefined,
  });
  const callbacks = useRef({
    onChange,
    onLint,
    onFormat,
    commands,
    onBreakpointsChange,
    onBreakpointKey,
  });
  callbacks.current = {
    onChange,
    onLint,
    onFormat,
    commands,
    onBreakpointsChange,
    onBreakpointKey,
  };

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
    const lineStart = (line: number) => {
      const doc = viewRef.current?.state.doc;
      return doc && line >= 1 && line <= doc.lines ? doc.line(line).from : null;
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
      insertBlock(block) {
        const view = viewRef.current;
        return view ? insertInto(view, block, view.state.selection.main.head) : null;
      },
      insertBeforeLine(line, block) {
        const view = viewRef.current;
        const start = lineStart(line);
        return view && start !== null ? insertInto(view, block, start) : null;
      },
      focus() {
        viewRef.current?.focus();
      },
      applyEdits(edits) {
        const view = viewRef.current;
        if (!view || view.state.readOnly) {
          return;
        }
        const length = view.state.doc.length;
        view.dispatch({
          changes: edits.map((edit) => ({
            from: Math.min(edit.from, length),
            to: Math.min(edit.to, length),
            insert: edit.insert,
          })),
        });
        view.focus();
      },
    };
  }, [engine]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const pageKeys = Prec.highest(
      keymap.of([
        { key: "Mod-Enter", run: () => true },
        {
          key: "Mod-Shift-m",
          run: () => {
            callbacks.current.commands?.onToggleFaults?.();
            return true;
          },
        },
        { key: "F8", run: nextDiagnostic },
        { key: "Shift-F8", run: previousDiagnostic },
      ]),
    );
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initial.current.value,
        extensions: [
          pageKeys,
          lineMarks(),
          initial.current.hasBreakpoints
            ? breakpoints({
                onChange: (lines) => callbacks.current.onBreakpointsChange?.(lines),
                onKeyToggle: (line, isSet) => callbacks.current.onBreakpointKey?.(line, isSet),
              })
            : [],
          lineNumbers(
            initial.current.hasBreakpoints
              ? {
                  domEventHandlers: {
                    mousedown: (view, line) => {
                      toggleBreakpoint(view, line.from);
                      return true;
                    },
                  },
                }
              : {},
          ),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          highlightWhitespace(),
          highlightTrailingWhitespace(),
          mineScriptLanguage(engine.keywords()),
          mineScriptHighlighting(),
          mineScriptLinter(engine, (report) => callbacks.current.onLint?.(report)),
          mineScriptCompletion(engine),
          mineScriptHover(engine),
          errorLens(),
          mineScriptKeymap(engine, (result) => callbacks.current.onFormat?.(result)),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          readOnly.current.of(readOnlyExtension(initial.current.isReadOnly)),
          initial.current.placeholder ? placeholderExtension(initial.current.placeholder) : [],
          EditorView.contentAttributes.of({
            tabindex: "0",
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

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setRuntimeMark.of(runtimeMark) });
  }, [runtimeMark]);

  useKeyboardFocusRing(hostRef);

  return <div ref={hostRef} className="code-host" data-readonly={isReadOnly} />;
}
