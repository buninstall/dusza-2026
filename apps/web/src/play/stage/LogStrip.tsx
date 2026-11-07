import type { Value } from "@minescript/engine";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { InlineText } from "../../components/InlineText.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { hu } from "../../i18n/hu.ts";
import { PixelText } from "../../pixel/PixelText.tsx";
import { type ConsoleEntry, formatValue } from "../derive.ts";
import "./LogStrip.css";

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

const LINE_KEYS: Record<string, (current: number, last: number) => number> = {
  ArrowDown: (current, last) => Math.min(current + 1, last),
  ArrowUp: (current) => Math.max(current - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

function useRovingLine(count: number) {
  const [picked, setPicked] = useState<number | null>(null);
  const last = count - 1;
  const active = picked === null || picked > last ? last : picked;
  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const move = LINE_KEYS[event.key];
    if (!move || count === 0) {
      return;
    }
    event.preventDefault();
    const next = move(active, last);
    setPicked(next === last ? null : next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>(".log-line-button")[next]?.focus();
  };
  return {
    active,
    onKeyDown,
    pick: (position: number) => setPicked(position === last ? null : position),
  };
}

export function ConsoleTape({ entries, canSeek, onSeek }: ConsoleTapeProps) {
  const endRef = useRef<HTMLLIElement>(null);
  const roving = useRovingLine(entries.length);
  useEffect(() => {
    if (entries.length > 0) {
      const tape = endRef.current?.closest<HTMLElement>(".log-scroll, .log-tape");
      if (tape) {
        tape.scrollTop = tape.scrollHeight;
      }
    }
  }, [entries.length]);

  return (
    <StripCell title={hu.play.console} className="log-console">
      {() => (
        <div role="log" aria-label={hu.play.console} className="log-tape">
          {entries.length === 0 ? (
            <p className="log-empty">{hu.play.consoleEmpty}</p>
          ) : (
            <ol className="log-lines" onKeyDown={roving.onKeyDown}>
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
                    tabIndex={position === roving.active ? 0 : -1}
                    onFocus={() => roving.pick(position)}
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

export const LOG_ID = "play-log";

type LogToggleProps = { count: number; isOpen: boolean; onToggle: () => void };

export function LogToggle({ count, isOpen, onToggle }: LogToggleProps) {
  return (
    <Button
      size="sm"
      icon="list"
      aria-expanded={isOpen}
      {...(isOpen ? { "aria-controls": LOG_ID } : {})}
      onPress={onToggle}
      className="log-toggle"
      data-open={isOpen}
    >
      {hu.play.logToggle}
      {count > 0 ? <span className="log-toggle-count">{count}</span> : null}
    </Button>
  );
}
