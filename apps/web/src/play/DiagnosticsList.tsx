import type { Diagnostic } from "@minescript/engine";
import { diagnosticTitles, hu, severityNames } from "../i18n/hu.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import "./PlayPage.css";

type DiagnosticsListProps = {
  diagnostics: readonly Diagnostic[];
  onReveal: (diagnostic: Diagnostic) => void;
};

export function countBySeverity(diagnostics: readonly Diagnostic[]) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  return { errors, warnings: diagnostics.length - errors };
}

export function DiagnosticsList({ diagnostics, onReveal }: DiagnosticsListProps) {
  const { errors, warnings } = countBySeverity(diagnostics);
  return (
    <section aria-labelledby="diagnostics-title" className="play-diagnostics">
      <h3 id="diagnostics-title" className="play-diagnostics-title">
        {hu.play.diagnosticsHeading}
        <span className="play-diagnostics-count">{hu.play.diagnosticsCount(errors, warnings)}</span>
      </h3>
      {diagnostics.length === 0 ? (
        <p className="play-diagnostics-ok">
          <PixelIcon name="check" size="sm" />
          {hu.play.diagnosticsEmpty}
        </p>
      ) : (
        <ul className="play-diagnostic-items">
          {diagnostics.map((diagnostic, position) => (
            <li
              key={`${diagnostic.code}-${diagnostic.span.from.toString()}-${position.toString()}`}
              data-severity={diagnostic.severity}
            >
              <button
                type="button"
                className="play-diagnostic-button"
                onClick={() => onReveal(diagnostic)}
              >
                <span className="visually-hidden">
                  {`${hu.play.jumpTo(diagnostic.span.line)}, ${severityNames[diagnostic.severity]}: `}
                </span>
                <span className="play-diagnostic-where">
                  {hu.play.diagnosticAt(diagnostic.span.line, diagnostic.span.colStart)}
                </span>
                <span className="play-diagnostic-text">
                  <strong>{diagnosticTitles[diagnostic.code]}</strong>
                  <span>{diagnostic.message}</span>
                  {diagnostic.help ? <span className="play-muted">{diagnostic.help}</span> : null}
                </span>
                <code className="play-diagnostic-code">{diagnostic.code}</code>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
