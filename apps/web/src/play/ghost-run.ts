import type { Pos, RobotState, RunResult } from "@minescript/engine";
import { useEffect, useRef, useState } from "react";
import { useEngine } from "../engine/useEngine.ts";
import type { GhostPath } from "../mine/scene/ghost.ts";
import { PROGRAM_MAX_CHARS } from "./program-file.ts";

const GHOST_DELAY_MS = 300;

export type GhostRun = GhostPath & { gold: number; steps: number; errorLine: number | null };

function samePos(a: Pos | undefined, b: Pos): boolean {
  return a !== undefined && a.row === b.row && a.col === b.col;
}

export function ghostOf(result: RunResult, start: RobotState): GhostRun | null {
  if (result.outcome.kind === "syntaxError") {
    return null;
  }
  const path: Pos[] = [start.pos];
  const mined: Pos[] = [];
  for (const event of result.events) {
    for (const pos of [...event.path, event.robot.pos]) {
      if (!samePos(path.at(-1), pos)) {
        path.push(pos);
      }
    }
    if (event.mined) {
      mined.push(event.mined);
    }
  }
  const isError = result.outcome.kind === "runtimeError";
  return {
    path,
    mined,
    end: result.finalRobot.pos,
    isError,
    gold: result.gold,
    steps: result.steps,
    errorLine: result.outcome.kind === "runtimeError" ? result.outcome.line : null,
  };
}

export function useGhostRun(
  source: string,
  mapText: string | undefined,
  start: RobotState,
  isEnabled: boolean,
): GhostRun | null {
  const engine = useEngine();
  const [ghost, setGhost] = useState<GhostRun | null>(null);
  const startRef = useRef(start);
  startRef.current = start;
  const startKey = `${start.pos.row}:${start.pos.col}:${start.dir}`;
  const isActive = isEnabled && mapText !== undefined && source.trim().length > 0;

  useEffect(() => {
    if (!isActive || mapText === undefined || source.length > PROGRAM_MAX_CHARS || !startKey) {
      setGhost(null);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        setGhost(ghostOf(engine.run(source, mapText), startRef.current));
      } catch {
        setGhost(null);
      }
    }, GHOST_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [engine, source, mapText, startKey, isActive]);

  return isActive ? ghost : null;
}
