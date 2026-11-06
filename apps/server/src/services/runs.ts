import type { Engine, RunResult } from "@minescript/engine";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { firstRow } from "../db/rows.ts";
import { type MapVersionRow, maps, mapVersions, type RunRow, runs } from "../db/schema.ts";
import type { SessionUser } from "../env.ts";
import { sha256Hex } from "../lib/crypto.ts";

export type RecordedRun =
  | { kind: "recorded"; run: RunRow; result: RunResult }
  | { kind: "syntaxError"; result: RunResult }
  | { kind: "missing" };

export type RunDetail = {
  run: {
    id: number;
    mapId: number;
    mapTitle: string;
    mapVersionId: number;
    version: number;
    gold: number;
    steps: number;
    outcomeKind: RunRow["outcomeKind"];
    errorCode: string | null;
    errorLine: number | null;
    createdAt: number;
    source: string;
  };
  map: { content: string };
};

export async function findRunDetail(
  db: Db,
  viewer: SessionUser,
  runId: number,
): Promise<RunDetail | null> {
  const [row] = await db
    .select({
      id: runs.id,
      userId: runs.userId,
      mapId: maps.id,
      mapTitle: maps.title,
      mapVersionId: runs.mapVersionId,
      version: mapVersions.version,
      gold: runs.gold,
      steps: runs.steps,
      outcomeKind: runs.outcomeKind,
      errorCode: runs.errorCode,
      errorLine: runs.errorLine,
      createdAt: runs.createdAt,
      source: runs.source,
      content: mapVersions.content,
    })
    .from(runs)
    .innerJoin(mapVersions, eq(mapVersions.id, runs.mapVersionId))
    .innerJoin(maps, eq(maps.id, mapVersions.mapId))
    .where(eq(runs.id, runId))
    .limit(1);
  if (!row) {
    return null;
  }
  const { userId, content, ...run } = row;
  const allowed = userId === viewer.id || viewer.role === "admin";
  return allowed ? { run, map: { content } } : null;
}

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
