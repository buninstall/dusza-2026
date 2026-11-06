import type { Engine, RunResult } from "@minescript/engine";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { firstRow } from "../db/rows.ts";
import { type MapVersionRow, mapVersions, type RunRow, runs } from "../db/schema.ts";
import { sha256Hex } from "../lib/crypto.ts";

export type RecordedRun =
  | { kind: "recorded"; run: RunRow; result: RunResult }
  | { kind: "syntaxError"; result: RunResult }
  | { kind: "missing" };

export function executeAndRecord(
  db: Db,
  engine: Engine,
  input: { userId: number; version: MapVersionRow; source: string; now: number },
): Promise<RecordedRun> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: mapVersions.id, content: mapVersions.content })
      .from(mapVersions)
      .where(eq(mapVersions.id, input.version.id))
      .for("share");
    if (!locked) {
      return { kind: "missing" };
    }
    const result = engine.run(input.source, locked.content);
    const outcome = result.outcome;
    if (outcome.kind === "syntaxError") {
      return { kind: "syntaxError", result };
    }
    const { id } = firstRow(
      await tx
        .insert(runs)
        .values({
          userId: input.userId,
          mapVersionId: locked.id,
          source: input.source,
          sourceHash: sha256Hex(input.source),
          gold: result.gold,
          steps: result.steps,
          outcomeKind: outcome.kind,
          errorCode: outcome.kind === "runtimeError" ? outcome.code : null,
          errorLine: outcome.kind === "runtimeError" ? outcome.line : null,
          createdAt: input.now,
        })
        .$returningId(),
    );
    const run = firstRow(await tx.select().from(runs).where(eq(runs.id, id)));
    return { kind: "recorded", run, result };
  });
}
