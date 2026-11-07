import { useMemo } from "react";
import type { RuntimeMark } from "../editor/exec-line.ts";
import { runtimeErrors } from "../i18n/hu.ts";
import { deriveFrame, type Frame } from "./derive.ts";
import {
  type Blocked,
  errorLinesOf,
  type ReportKind,
  reportKind,
  type StagePhase,
  stagePhase,
} from "./phase.ts";
import { isLiveRun, usePlayback } from "./playback-store.ts";

const NO_LINES: readonly number[] = [];

export type PlayView = {
  frame: Frame | null;
  phase: StagePhase;
  report: ReportKind | null;
  isLocked: boolean;
  isTraceOfEditor: boolean;
  execLine: number | null;
  errorLines: readonly number[];
  runtimeMark: RuntimeMark | null;
};

export function usePlayView(editorSource: string, blocked: Blocked | null): PlayView {
  const result = usePlayback((state) => state.result);
  const runStart = usePlayback((state) => state.start);
  const runSource = usePlayback((state) => state.source);
  const index = usePlayback((state) => state.index);
  const status = usePlayback((state) => state.status);
  const hasEnded = usePlayback((state) => state.hasEnded);

  const frame = useMemo(
    () => (result && runStart ? deriveFrame(result, runStart, index) : null),
    [result, runStart, index],
  );
  const input = { status, hasEnded, outcome: result?.outcome ?? null, blocked };
  const phase = stagePhase(input);
  const report = reportKind(input);
  const isTraceOfEditor = editorSource === runSource && result !== null;
  const outcome = result?.outcome;
  const runtimeLine =
    isTraceOfEditor && frame?.atEnd && outcome?.kind === "runtimeError" ? outcome.line : null;

  const errorLines = useMemo(
    () => (blocked?.kind === "syntax" ? errorLinesOf(blocked.diagnostics) : NO_LINES),
    [blocked],
  );
  const runtimeCode = outcome?.kind === "runtimeError" ? outcome.code : null;
  const runtimeMark = useMemo<RuntimeMark | null>(
    () =>
      runtimeLine !== null && runtimeCode !== null
        ? { line: runtimeLine, text: `${runtimeErrors[runtimeCode].title} · ${runtimeCode}` }
        : null,
    [runtimeLine, runtimeCode],
  );

  return {
    frame,
    phase,
    report,
    isLocked: status === "playing" || isLiveRun(status, hasEnded),
    isTraceOfEditor,
    execLine: isTraceOfEditor && runtimeLine === null ? (frame?.line ?? null) : null,
    errorLines,
    runtimeMark,
  };
}

export function lineTextOf(source: string, line: number | null): string | null {
  if (line === null) {
    return null;
  }
  return source.split("\n")[line - 1] ?? null;
}
