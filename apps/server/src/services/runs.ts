import type { Engine, RunResult } from "@minescript/engine";
import type { Db } from "../db/client.ts";
import { type MapVersionRow, type RunRow, runs } from "../db/schema.ts";
import { sha256Hex } from "../lib/crypto.ts";

export type RecordedRun =
  | { kind: "recorded"; run: RunRow; result: RunResult }
  | { kind: "syntaxError"; result: RunResult };

export function executeAndRecord(
  db: Db,
  engine: Engine,
  input: { userId: number; version: MapVersionRow; source: string; now: number },
): RecordedRun {
  const result = engine.run(input.source, input.version.content);
  const outcome = result.outcome;
  if (outcome.kind === "syntaxError") {
    return { kind: "syntaxError", result };
  }
  const run = db
    .insert(runs)
    .values({
      userId: input.userId,
      mapVersionId: input.version.id,
      source: input.source,
      sourceHash: sha256Hex(input.source),
      gold: result.gold,
      steps: result.steps,
      outcomeKind: outcome.kind,
      errorCode: outcome.kind === "runtimeError" ? outcome.code : null,
      errorLine: outcome.kind === "runtimeError" ? outcome.line : null,
      createdAt: input.now,
    })
    .returning()
    .get();
  return { kind: "recorded", run, result };
}
