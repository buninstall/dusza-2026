import type { RobotState, RunResult } from "@minescript/engine";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import type { Blocked } from "./phase.ts";
import { usePlayback } from "./playback-store.ts";
import { PROGRAM_MAX_CHARS } from "./program-file.ts";

export type Submission =
  | { state: "pending" }
  | { state: "done"; gold: number; steps: number }
  | { state: "error"; message: string };

type TrackedSubmission = { runId: number; value: Submission };

export type RunAttempt = { blocked: Blocked | null; attempt: number; wasRefused: boolean };

export function useEngineRun(mapText: string, start: RobotState) {
  const engine = useEngine();
  const [state, setState] = useState<RunAttempt>({ blocked: null, attempt: 0, wasRefused: false });

  const refuse = (blocked: Blocked) => {
    usePlayback.getState().clear();
    setState((current) => ({ blocked, attempt: current.attempt + 1, wasRefused: true }));
    return false;
  };

  const run = (source: string): boolean => {
    if (source.length > PROGRAM_MAX_CHARS) {
      return refuse({ kind: "tooLong", length: source.length });
    }
    let result: RunResult;
    try {
      result = engine.run(source, mapText);
    } catch {
      return refuse({ kind: "engine" });
    }
    if (result.outcome.kind === "syntaxError") {
      return refuse({ kind: "syntax", diagnostics: result.outcome.diagnostics });
    }
    setState((current) => ({ blocked: null, attempt: current.attempt + 1, wasRefused: false }));
    usePlayback.getState().load(result, start, source);
    return true;
  };

  const clearBlocked = useCallback(
    () => setState((current) => (current.blocked ? { ...current, blocked: null } : current)),
    [],
  );

  return { run, ...state, clearBlocked };
}

type SubmissionInput = { mapId: number; mapVersionId: number };

export function useRunSubmission({ mapId, mapVersionId }: SubmissionInput) {
  const queryClient = useQueryClient();
  const status = usePlayback((state) => state.status);
  const runId = usePlayback((state) => state.runId);
  const runSource = usePlayback((state) => state.source);
  const [tracked, setTracked] = useState<TrackedSubmission | null>(null);
  const submittedRun = useRef(0);

  const submit = useCallback(
    async (id: number, source: string) => {
      setTracked({ runId: id, value: { state: "pending" } });
      try {
        const response = await call(api.runs.$post({ json: { mapVersionId, source } }));
        setTracked({
          runId: id,
          value: { state: "done", gold: response.run.gold, steps: response.run.steps },
        });
        void queryClient.invalidateQueries({ queryKey: ["map", mapId] });
        void queryClient.invalidateQueries({ queryKey: ["leaderboard", mapId] });
        void queryClient.invalidateQueries({ queryKey: ["my-runs"] });
      } catch (error) {
        setTracked({
          runId: id,
          value: { state: "error", message: errorMessage(error, hu.play.submitFailed) },
        });
      }
    },
    [mapId, mapVersionId, queryClient],
  );

  useEffect(() => {
    if (status === "finished" && submittedRun.current !== runId) {
      submittedRun.current = runId;
      void submit(runId, runSource);
    }
  }, [status, runId, runSource, submit]);

  return {
    submission: tracked?.runId === runId ? tracked.value : null,
    retrySubmit: () => void submit(runId, runSource),
  };
}
