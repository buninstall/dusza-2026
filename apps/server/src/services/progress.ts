import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { runs } from "../db/schema.ts";
import { type Score, starsFor } from "./stars.ts";

export function bestRunsOf(db: Db, userId: number) {
  return db
    .select({
      mapVersionId: runs.mapVersionId,
      gold: runs.gold,
      steps: runs.steps,
      position: sql<number>`row_number() over (
        partition by ${runs.mapVersionId}
        order by ${runs.gold} desc, ${runs.steps} asc, ${runs.createdAt} asc, ${runs.id} asc
      )`.as("position"),
    })
    .from(runs)
    .where(eq(runs.userId, userId))
    .as("mine");
}

export async function bestScore(
  db: Db,
  userId: number,
  mapVersionId: number,
  exceptRunId?: number,
): Promise<Score | null> {
  const [row] = await db
    .select({ gold: runs.gold, steps: runs.steps })
    .from(runs)
    .where(
      and(
        eq(runs.userId, userId),
        eq(runs.mapVersionId, mapVersionId),
        exceptRunId === undefined ? undefined : ne(runs.id, exceptRunId),
      ),
    )
    .orderBy(desc(runs.gold), asc(runs.steps), asc(runs.createdAt), asc(runs.id))
    .limit(1);
  return row ?? null;
}

export type Progress = { best: Score | null; stars: number | null };

export function progressOf(
  best: Score | null,
  reachableGold: number,
  parSteps: number | null,
): Progress {
  return { best, stars: starsFor(best, reachableGold, parSteps) };
}
