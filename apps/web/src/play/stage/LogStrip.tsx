import type { Value } from "@minescript/engine";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { InlineText } from "../../components/InlineText.tsx";
import { hu } from "../../i18n/hu.ts";
import { PixelText } from "../../pixel/PixelText.tsx";
import { type ConsoleEntry, formatValue } from "../derive.ts";

function StripCell({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children: (headingId: string) => ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`log-cell ${className}`}>
      <h2 id={headingId} className="log-head">
        <PixelText text={title} scale={2} />
        <span className="visually-hidden">{title}</span>
      </h2>
      {children(headingId)}
    </section>
  );
}

type ConsoleTapeProps = {
  entries: readonly ConsoleEntry[];
  canSeek: boolean;
  onSeek: (index: number) => void;
};

export function ConsoleTape({ entries, canSeek, onSeek }: ConsoleTapeProps) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (entries.length > 0) {
      endRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [entries.length]);

  return (
    <StripCell title={hu.play.console} className="log-console">
      {() => (
        <div role="log" aria-label={hu.play.console} className="log-tape">
          {entries.length === 0 ? (
            <p className="log-empty">{hu.play.consoleEmpty}</p>
          ) : (
            <ol className="log-lines">
              {entries.map((entry, position) => (
                <li
                  key={`${entry.index.toString()}-${position.toString()}`}
                  ref={position === entries.length - 1 ? endRef : undefined}
                  className="log-line"
                >
                  <button
                    type="button"
                    className="log-line-button"
                    disabled={!canSeek}
                    aria-label={hu.play.consoleJump(entry.step, entry.text)}
                    onClick={() => onSeek(entry.index)}
                  >
                    <span className="log-step">{hu.play.consoleLine(entry.step)}</span>
                    <samp
                      data-kind={entry.text === "true" || entry.text === "false" ? "bool" : "int"}
                    >
                      {entry.text}
                    </samp>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </StripCell>
  );
}

type MemoryTableProps = { variables: ReadonlyMap<string, Value>; changed: string | null };

export function MemoryTable({ variables, changed }: MemoryTableProps) {
  return (
    <StripCell title={hu.play.variables} className="log-memory">
      {() =>
        variables.size === 0 ? (
          <p className="log-empty">
            <InlineText text={hu.play.noVariables} />
          </p>
        ) : (
          <div className="log-scroll">
            <table className="log-table">
              <caption className="visually-hidden">{hu.play.variables}</caption>
              <thead>
                <tr>
                  <th scope="col">{hu.play.variableName}</th>
                  <th scope="col">{hu.play.variableType}</th>
                  <th scope="col">{hu.play.variableValue}</th>
                </tr>
              </thead>
              <tbody>
                {[...variables].map(([name, value]) => (
                  <tr key={name} data-changed={name === changed}>
                    <th scope="row">
                      <code>{name}</code>
                      {name === changed ? (
                        <span className="log-changed">
                          <span aria-hidden="true">•</span>
                          <span className="visually-hidden">{hu.play.changedNow}</span>
                        </span>
                      ) : null}
                    </th>
                    <td>{value.kind === "int" ? hu.play.typeInt : hu.play.typeBool}</td>
                    <td>
                      <code data-kind={value.kind}>{formatValue(value)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </StripCell>
  );
}

export function ReportCell({ children }: { children: ReactNode }) {
  return (
    <StripCell title={hu.play.report} className="log-report">
      {() => children}
    </StripCell>
  );
}
