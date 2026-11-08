import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { manual } from "../i18n/hu-manual.ts";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { MineBoard } from "../mine/MineBoard.tsx";
import { posKey } from "../mine/tiles-model.ts";
import { deriveFrame } from "../play/derive.ts";
import { CodeListing } from "./CodeListing.tsx";
import "./Bench.css";

const TICK_MS = 500;

type BenchProps = { code: string; map: string; caption: string };

function useTicker(total: number) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    if (index >= total) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setIndex((current) => current + 1), TICK_MS);
    return () => window.clearTimeout(id);
  }, [isPlaying, index, total]);
  const toggle = () => {
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (index >= total) {
      setIndex(0);
    }
    setPlaying(true);
  };
  const restart = () => {
    setPlaying(false);
    setIndex(0);
  };
  return { index, isPlaying, toggle, restart };
}

export function Bench({ code, map, caption }: BenchProps) {
  const engine = useEngine();
  const isReduced = usePrefersReducedMotion();
  const parsed = useMemo(() => engine.parseMap(map).map, [engine, map]);
  const result = useMemo(() => engine.run(code, map), [engine, code, map]);
  const ticker = useTicker(result.events.length);
  const known = useMemo(
    () =>
      new Set(
        parsed?.cells.flatMap((row, rowIndex) =>
          row.map((_, colIndex) => posKey({ row: rowIndex, col: colIndex })),
        ) ?? [],
      ),
    [parsed],
  );
  if (!parsed) {
    return <CodeListing code={code} caption={caption} />;
  }
  const frame = deriveFrame(result, { pos: parsed.robot, dir: parsed.dir }, ticker.index);
  const outcome = result.outcome;
  const fault =
    frame.atEnd && outcome.kind === "runtimeError"
      ? hu.play.runtimeErrorWithCode(outcome.code, outcome.line)
      : null;
  return (
    <figure className="bench" data-fault={fault !== null}>
      <figcaption className="bench-caption">{caption}</figcaption>
      <div className="bench-body">
        <CodeListing code={code} currentLine={frame.line} />
        <div className="bench-stage">
          <div className="bench-board">
            <MineBoard
              map={parsed}
              robot={frame.robot}
              label={manual.benchBoard(caption)}
              exploration={{ discovered: known, mined: frame.mined, mode: "full" }}
              stepMs={isReduced ? 0 : TICK_MS - 100}
              fit="width"
            />
          </div>
          <div className="bench-bar">
            <Button
              size="sm"
              variant="primary"
              icon={ticker.isPlaying ? "pause" : "play"}
              onPress={ticker.toggle}
            >
              {ticker.isPlaying ? manual.benchPause : manual.benchPlay}
            </Button>
            <Button size="sm" icon="rewind" onPress={ticker.restart} isDisabled={frame.atStart}>
              {manual.benchRestart}
            </Button>
            <output className="bench-stats">
              {fault ?? manual.benchStats(frame.gold, frame.steps)}
            </output>
          </div>
          {frame.console.length > 0 ? (
            <p className="bench-console">{frame.console.map((entry) => entry.text).join("  ")}</p>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
