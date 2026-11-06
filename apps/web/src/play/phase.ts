import type { Diagnostic, Outcome } from "@minescript/engine";
import type { LedBlink, LedState } from "../components/Led.tsx";
import { hu } from "../i18n/hu.ts";
import type { PlaybackStatus } from "./playback-store.ts";

export type Blocked =
  | { kind: "syntax"; diagnostics: readonly Diagnostic[] }
  | { kind: "tooLong"; length: number }
  | { kind: "engine" };

export type StagePhase =
  | "idle"
  | "blocked"
  | "playing"
  | "paused"
  | "review"
  | "finished"
  | "error"
  | "limit"
  | "stopped"
  | "crash";

export type ReportKind = "ok" | "error" | "limit" | "stopped" | "blocked" | "crash";

export type Mood = "run" | "ok" | "error" | "limit" | "stopped";

export const LIMIT_CODE = "INSTRUCTION_COUNT_LIMIT_EXCEEDED";

type PhaseInput = {
  status: PlaybackStatus;
  hasEnded: boolean;
  outcome: Outcome | null;
  blocked: Blocked | null;
};

function endedKind(outcome: Outcome | null): "finished" | "error" | "limit" {
  if (outcome?.kind !== "runtimeError") {
    return "finished";
  }
  return outcome.code === LIMIT_CODE ? "limit" : "error";
}

export function stagePhase({ status, hasEnded, outcome, blocked }: PhaseInput): StagePhase {
  if (blocked) {
    return blocked.kind === "engine" ? "crash" : "blocked";
  }
  switch (status) {
    case "idle":
    case "playing":
    case "stopped":
      return status;
    case "paused":
      return hasEnded ? "review" : "paused";
    case "finished":
      return endedKind(outcome);
  }
}

export function reportKind({ status, hasEnded, outcome, blocked }: PhaseInput): ReportKind | null {
  if (blocked) {
    return blocked.kind === "engine" ? "crash" : "blocked";
  }
  if (status === "stopped") {
    return "stopped";
  }
  if (!hasEnded || status === "idle") {
    return null;
  }
  const ended = endedKind(outcome);
  return ended === "finished" ? "ok" : ended;
}

type Lamp = { led: LedState; label: string; blink: LedBlink };

const LAMPS: Record<StagePhase, Lamp> = {
  idle: { led: "off", label: hu.play.statusIdle, blink: false },
  blocked: { led: "error", label: hu.play.statusBlocked, blink: false },
  playing: { led: "busy", label: hu.play.statusPlaying, blink: true },
  paused: { led: "warn", label: hu.play.statusPaused, blink: false },
  review: { led: "warn", label: hu.play.statusReview, blink: false },
  finished: { led: "ok", label: hu.play.statusFinished, blink: false },
  error: { led: "error", label: hu.play.statusError, blink: "thrice" },
  limit: { led: "error", label: hu.play.statusError, blink: "thrice" },
  stopped: { led: "off", label: hu.play.statusStopped, blink: false },
  crash: { led: "error", label: hu.play.statusError, blink: false },
};

export function lampFor(phase: StagePhase): Lamp {
  return LAMPS[phase];
}

const MOODS: Record<StagePhase, Mood> = {
  idle: "run",
  blocked: "error",
  playing: "run",
  paused: "run",
  review: "run",
  finished: "ok",
  error: "error",
  limit: "limit",
  stopped: "stopped",
  crash: "error",
};

export function moodFor(phase: StagePhase): Mood {
  return MOODS[phase];
}

export function errorLinesOf(diagnostics: readonly Diagnostic[]): number[] {
  return [
    ...new Set(
      diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.span.line),
    ),
  ].sort((a, b) => a - b);
}
