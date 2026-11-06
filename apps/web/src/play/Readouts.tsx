import type { Value } from "@minescript/engine";
import { useEffect, useRef } from "react";
import { Panel } from "../components/Panel.tsx";
import { hu } from "../i18n/hu.ts";
import { type ConsoleEntry, formatValue } from "./derive.ts";
import "./PlayPage.css";

export function ConsoleTape({ entries }: { entries: readonly ConsoleEntry[] }) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (entries.length > 0) {
      endRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [entries.length]);

  return (
    <Panel title={hu.play.console} tone="screen" bodyClassName="play-console-body">
      <div role="log" aria-label={hu.play.console} className="play-tape">
        {entries.length === 0 ? (
          <p className="play-tape-empty">{hu.play.consoleEmpty}</p>
        ) : (
          <ol className="play-tape-lines">
            {entries.map((entry, position) => (
              <li
                key={`${entry.step.toString()}-${position.toString()}`}
                ref={position === entries.length - 1 ? endRef : undefined}
              >
                <span className="play-tape-step">{hu.play.consoleLine(entry.step)}</span>
                <samp>{entry.text}</samp>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}

export function VariablesPanel({ variables }: { variables: ReadonlyMap<string, Value> }) {
  return (
    <Panel title={hu.play.variables}>
      {variables.size === 0 ? (
        <p className="play-muted">{hu.play.noVariables}</p>
      ) : (
        <table className="play-registers">
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
              <tr key={name}>
                <th scope="row">
                  <code>{name}</code>
                </th>
                <td>{value.kind === "int" ? hu.play.typeInt : hu.play.typeBool}</td>
                <td>
                  <code data-kind={value.kind}>{formatValue(value)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
