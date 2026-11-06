import type { Diagnostic, RobotState } from "@minescript/engine";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { usePlayback } from "./playback-store.ts";

export type Submission =
  | { state: "pending" }
  | { state: "done"; gold: number; steps: number }
  | { state: "error"; message: string };

type RunSessionInput = { mapId: number; mapVersionId: number; mapText: string; start: RobotState };

type TrackedSubmission = { runId: number; value: Submission };

export function useRunSession({ mapId, mapVersionId, mapText, start }: RunSessionInput) {
  const engine = useEngine();
  const queryClient = useQueryClient();
  const status = usePlayback((state) => state.status);
  const runId = usePlayback((state) => state.runId);
  const runSource = usePlayback((state) => state.source);
  const [syntaxErrors, setSyntaxErrors] = useState<Diagnostic[] | null>(null);
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

  const run = (source: string): boolean => {
    const result = engine.run(source, mapText);
    if (result.outcome.kind === "syntaxError") {
      setSyntaxErrors(result.outcome.diagnostics);
      usePlayback.getState().clear();
      return false;
    }
    setSyntaxErrors(null);
    usePlayback.getState().load(result, start, source);
    return true;
  };

  const retrySubmit = () => void submit(runId, runSource);

  return {
    run,
    syntaxErrors,
    clearSyntaxErrors: () => setSyntaxErrors(null),
    submission: tracked?.runId === runId ? tracked.value : null,
    retrySubmit,
  };
}
