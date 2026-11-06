import { type Diagnostic as CmDiagnostic, linter, lintGutter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Diagnostic, Engine, Severity } from "@minescript/engine";

const LINT_DELAY_MS = 250;

const severityMap: Record<Severity, CmDiagnostic["severity"]> = {
  error: "error",
  warning: "warning",
  info: "info",
  hint: "hint",
};

export function toCodeMirror(diagnostic: Diagnostic, docLength: number): CmDiagnostic {
  const from = Math.min(diagnostic.span.from, docLength);
  const to = Math.min(Math.max(diagnostic.span.to, from), docLength);
  return {
    from,
    to,
    severity: severityMap[diagnostic.severity],
    source: diagnostic.code,
    message: diagnostic.help ? `${diagnostic.message} ${diagnostic.help}` : diagnostic.message,
    actions: diagnostic.fixes.map((fix) => ({
      name: fix.title,
      apply(view: EditorView) {
        view.dispatch({
          changes: fix.edits.map((edit) => ({ from: edit.from, to: edit.to, insert: edit.insert })),
        });
      },
    })),
  };
}

export function mineScriptLinter(
  engine: Engine,
  onDiagnostics?: (diagnostics: Diagnostic[]) => void,
): Extension {
  return [
    lintGutter(),
    linter(
      (view) => {
        const text = view.state.doc.toString();
        const { diagnostics } = engine.analyze(text);
        onDiagnostics?.(diagnostics);
        return diagnostics.map((diagnostic) => toCodeMirror(diagnostic, text.length));
      },
      { delay: LINT_DELAY_MS },
    ),
  ];
}
