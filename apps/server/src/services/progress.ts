import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { mapLikes, mapVersions, runs } from "../db/schema.ts";
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

export function likeCounts(db: Db) {
  return db
    .select({ mapId: mapLikes.mapId, likes: count().as("likes") })
    .from(mapLikes)
    .groupBy(mapLikes.mapId)
    .as("liked");
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

export async function hasPlayed(db: Db, userId: number, mapId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: runs.id })
    .from(runs)
    .innerJoin(mapVersions, eq(mapVersions.id, runs.mapVersionId))
    .where(and(eq(runs.userId, userId), eq(mapVersions.mapId, mapId)))
    .limit(1);
  return row !== undefined;
}

export async function likeState(
  db: Db,
  userId: number,
  mapId: number,
): Promise<{ likes: number; likedByMe: boolean }> {
  const [total] = await db
    .select({ value: count() })
    .from(mapLikes)
    .where(eq(mapLikes.mapId, mapId));
  const [mine] = await db
    .select({ mapId: mapLikes.mapId })
    .from(mapLikes)
    .where(and(eq(mapLikes.mapId, mapId), eq(mapLikes.userId, userId)))
    .limit(1);
  return { likes: total?.value ?? 0, likedByMe: mine !== undefined };
}

export async function setLike(
  db: Db,
  input: { userId: number; mapId: number; liked: boolean; now: number },
): Promise<void> {
  if (input.liked) {
    await db
      .insert(mapLikes)
      .values({ userId: input.userId, mapId: input.mapId, createdAt: input.now })
      .onDuplicateKeyUpdate({ set: { userId: input.userId } });
    return;
  }
  await db
    .delete(mapLikes)
    .where(and(eq(mapLikes.userId, input.userId), eq(mapLikes.mapId, input.mapId)));
}

export type Progress = { best: Score | null; stars: number | null };

export function progressOf(
  best: Score | null,
  reachableGold: number,
  parSteps: number | null,
): Progress {
  return { best, stars: starsFor(best, reachableGold, parSteps) };
}
