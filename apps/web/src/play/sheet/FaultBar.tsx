import type { Diagnostic } from "@minescript/engine";
import { useId } from "react";
import { Led } from "../../components/Led.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { diagnosticTitles, hu, severityNames } from "../../i18n/hu.ts";

export const FAULT_LIST_LIMIT = 200;

export function countBySeverity(diagnostics: readonly Diagnostic[]) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  return { errors, warnings: diagnostics.length - errors };
}

type FaultBarProps = {
  diagnostics: readonly Diagnostic[];
  hasAnalyzerFailed: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onReveal: (diagnostic: Diagnostic) => void;
  onFix: (diagnostic: Diagnostic) => void;
};

function FaultItem({
  diagnostic,
  onReveal,
  onFix,
}: {
  diagnostic: Diagnostic;
  onReveal: (diagnostic: Diagnostic) => void;
  onFix: (diagnostic: Diagnostic) => void;
}) {
  const fix = diagnostic.fixes[0];
  return (
    <li className="faults-item" data-severity={diagnostic.severity}>
      <button type="button" className="faults-jump" onClick={() => onReveal(diagnostic)}>
        <span className="visually-hidden">
          {`${hu.play.jumpTo(diagnostic.span.line)}, ${severityNames[diagnostic.severity]}: `}
        </span>
        <span className="faults-where">
          {hu.play.diagnosticAt(diagnostic.span.line, diagnostic.span.colStart)}
        </span>
        <span className="faults-text">
          <strong>{diagnosticTitles[diagnostic.code]}.</strong> {diagnostic.message}
        </span>
      </button>
      {fix ? (
        <Button
          size="sm"
          variant="ghost"
          icon="check"
          aria-label={hu.play.fix(fix.title)}
          onPress={() => onFix(diagnostic)}
        >
          {hu.play.fixShort}
        </Button>
      ) : null}
    </li>
  );
}

export function FaultBar({
  diagnostics,
  hasAnalyzerFailed,
  isOpen,
  onOpenChange,
  onReveal,
  onFix,
}: FaultBarProps) {
  const headingId = useId();
  const countId = useId();
  const listId = useId();
  const { errors, warnings } = countBySeverity(diagnostics);
  const first = diagnostics.find((diagnostic) => diagnostic.severity === "error") ?? diagnostics[0];
  const shown = diagnostics.slice(0, FAULT_LIST_LIMIT);
  const led = errors > 0 || hasAnalyzerFailed ? "error" : warnings > 0 ? "warn" : "ok";
  const ledLabel = hasAnalyzerFailed
    ? hu.play.analyzerFailed
    : diagnostics.length === 0
      ? hu.play.diagnosticsEmpty
      : hu.play.diagnosticsCount(errors, warnings);
  return (
    <section
      aria-labelledby={`${headingId} ${countId}`}
      className="faults"
      data-open={isOpen}
      data-state={led}
    >
      {isOpen && shown.length > 0 ? (
        <ul id={listId} className="faults-list">
          {shown.map((diagnostic, position) => (
            <FaultItem
              key={`${diagnostic.code}-${diagnostic.span.from.toString()}-${position.toString()}`}
              diagnostic={diagnostic}
              onReveal={onReveal}
              onFix={onFix}
            />
          ))}
          {diagnostics.length > FAULT_LIST_LIMIT ? (
            <li className="faults-more">
              {hu.play.diagnosticsMore(diagnostics.length - FAULT_LIST_LIMIT)}
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="faults-bar">
        <h2 id={headingId} className="visually-hidden">
          {hu.play.diagnosticsHeading}
        </h2>
        <span id={countId} className="faults-led">
          <Led state={led} label={ledLabel} isSentenceCase />
        </span>
        {first && !isOpen ? (
          <button type="button" className="faults-preview" onClick={() => onReveal(first)}>
            <span className="faults-where">
              {hu.play.diagnosticAt(first.span.line, first.span.colStart)}
            </span>
            {diagnosticTitles[first.code]}
          </button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          icon="chevronDown"
          className="faults-toggle"
          aria-expanded={isOpen}
          {...(isOpen && shown.length > 0 ? { "aria-controls": listId } : {})}
          aria-keyshortcuts="Control+Shift+M"
          isDisabled={diagnostics.length === 0}
          onPress={() => onOpenChange(!isOpen)}
        >
          {hu.play.diagnosticsHeading}
        </Button>
      </div>
    </section>
  );
}
