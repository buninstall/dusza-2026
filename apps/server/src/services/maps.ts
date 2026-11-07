import type { Diagnostic, Engine, MapInfo, MineMap } from "@minescript/engine";
import { and, asc, count, desc, eq, isNull, max, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { firstRow } from "../db/rows.ts";
import {
  type DifficultyMark,
  type MapRow,
  type MapVersionRow,
  maps,
  mapVersions,
  runs,
  users,
} from "../db/schema.ts";
import type { SessionUser } from "../env.ts";
import { sha256Hex } from "../lib/crypto.ts";
import { type Difficulty, difficultyOf } from "./generator.ts";

export type ValidMapContent = {
  ok: true;
  canonical: string;
  contentHash: string;
  map: MineMap;
  info: MapInfo;
  difficulty: Difficulty | null;
  warnings: Diagnostic[];
};

export type InvalidMapContent = { ok: false; diagnostics: Diagnostic[] };

export function validateMapContent(
  engine: Engine,
  content: string,
): ValidMapContent | InvalidMapContent {
  const parsed = engine.parseMap(content);
  if (!parsed.map) {
    return { ok: false, diagnostics: parsed.diagnostics };
  }
  const canonical = engine.serializeMap(parsed.map);
  const contentHash = sha256Hex(canonical);
  return {
    ok: true,
    canonical,
    contentHash,
    map: parsed.map,
    info: engine.mapInfo(parsed.map),
    difficulty: difficultyOf(engine, canonical, contentHash),
    warnings: parsed.diagnostics,
  };
}

export function canonicalHash(engine: Engine, content: string): string | null {
  const parsed = engine.parseMap(content);
  return parsed.map ? sha256Hex(engine.serializeMap(parsed.map)) : null;
}

export function difficultyMark(difficulty: Difficulty | null): DifficultyMark {
  return difficulty ?? "none";
}

export function markedDifficulty(mark: DifficultyMark | null): Difficulty | null {
  return mark === null || mark === "none" ? null : mark;
}

export function versionValues(valid: ValidMapContent) {
  return {
    content: valid.canonical,
    contentHash: valid.contentHash,
    rows: valid.map.rows,
    cols: valid.map.cols,
    goldTotal: valid.info.goldTotal,
    reachableGold: valid.info.reachableGold,
    difficulty: difficultyMark(valid.difficulty),
  };
}

const BACKFILL_BATCH = 200;

export async function backfillDifficulty(db: Db, engine: Engine): Promise<number> {
  let filled = 0;
  for (;;) {
    const pending = await db
      .select({ id: mapVersions.id, content: mapVersions.content, hash: mapVersions.contentHash })
      .from(mapVersions)
      .where(isNull(mapVersions.difficulty))
      .limit(BACKFILL_BATCH);
    for (const version of pending) {
      await db
        .update(mapVersions)
        .set({ difficulty: difficultyMark(difficultyOf(engine, version.content, version.hash)) })
        .where(eq(mapVersions.id, version.id));
    }
    filled += pending.length;
    if (pending.length < BACKFILL_BATCH) {
      return filled;
    }
  }
}

export function canView(user: SessionUser, map: MapRow): boolean {
  return map.visibility === "public" || map.ownerId === user.id || user.role === "admin";
}

export function canExport(user: SessionUser, map: MapRow): boolean {
  return map.lampMode === "open" || map.ownerId === user.id || user.role === "admin";
}

export function canEdit(user: SessionUser, map: MapRow): boolean {
  return map.dailyDate === null && (map.ownerId === user.id || user.role === "admin");
}

export function visibleTo(user: SessionUser, scope: "all" | "mine"): SQL | undefined {
  if (scope === "mine") {
    return eq(maps.ownerId, user.id);
  }
  if (user.role === "admin") {
    return undefined;
  }
  return or(eq(maps.visibility, "public"), eq(maps.ownerId, user.id));
}

export async function findMap(db: Db, id: number): Promise<MapRow | undefined> {
  const [map] = await db.select().from(maps).where(eq(maps.id, id)).limit(1);
  return map;
}

export async function findVersion(db: Db, id: number): Promise<MapVersionRow | undefined> {
  const [version] = await db.select().from(mapVersions).where(eq(mapVersions.id, id)).limit(1);
  return version;
}

export async function currentVersion(db: Db, map: MapRow): Promise<MapVersionRow | undefined> {
  if (map.currentVersionId === null) {
    return undefined;
  }
  return findVersion(db, map.currentVersionId);
}

export function versionList(db: Db, mapId: number) {
  return db
    .select({
      id: mapVersions.id,
      version: mapVersions.version,
      createdAt: mapVersions.createdAt,
    })
    .from(mapVersions)
    .where(eq(mapVersions.mapId, mapId))
    .orderBy(asc(mapVersions.version));
}

export async function runCount(db: Db, mapVersionId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(runs)
    .where(eq(runs.mapVersionId, mapVersionId));
  return row?.value ?? 0;
}

export function createMapWithVersion(
  db: Db,
  input: {
    ownerId: number;
    title: string;
    description: string;
    visibility: MapRow["visibility"];
    valid: ValidMapContent;
    now: number;
    parSteps?: number | null;
    lampMode?: MapRow["lampMode"];
    dailyDate?: string | null;
  },
): Promise<MapRow> {
  return db.transaction(async (tx) => {
    const { id: mapId } = firstRow(
      await tx
        .insert(maps)
        .values({
          ownerId: input.ownerId,
          title: input.title,
          description: input.description,
          visibility: input.visibility,
          parSteps: input.parSteps ?? null,
          lampMode: input.lampMode ?? "open",
          dailyDate: input.dailyDate ?? null,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .$returningId(),
    );
    const { id: versionId } = firstRow(
      await tx
        .insert(mapVersions)
        .values({ mapId, version: 1, createdAt: input.now, ...versionValues(input.valid) })
        .$returningId(),
    );
    await tx.update(maps).set({ currentVersionId: versionId }).where(eq(maps.id, mapId));
    return firstRow(await tx.select().from(maps).where(eq(maps.id, mapId)));
  });
}

export function replaceContent(
  db: Db,
  map: MapRow,
  valid: ValidMapContent,
  now: number,
): Promise<{ versionId: number; createdNewVersion: boolean }> {
  const values = versionValues(valid);
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ currentVersionId: maps.currentVersionId })
      .from(maps)
      .where(eq(maps.id, map.id))
      .for("update");
    const [current] =
      locked?.currentVersionId == null
        ? []
        : await tx
            .select({ id: mapVersions.id, contentHash: mapVersions.contentHash })
            .from(mapVersions)
            .where(eq(mapVersions.id, locked.currentVersionId))
            .for("update");
    if (current && current.contentHash === values.contentHash) {
      return { versionId: current.id, createdNewVersion: false };
    }
    if (current) {
      const [recorded] = await tx
        .select({ value: count() })
        .from(runs)
        .where(eq(runs.mapVersionId, current.id))
        .for("share");
      if ((recorded?.value ?? 0) === 0) {
        await tx.update(mapVersions).set(values).where(eq(mapVersions.id, current.id));
        return { versionId: current.id, createdNewVersion: false };
      }
    }
    const [latest] = await tx
      .select({ value: max(mapVersions.version) })
      .from(mapVersions)
      .where(eq(mapVersions.mapId, map.id));
    const { id: versionId } = firstRow(
      await tx
        .insert(mapVersions)
        .values({ mapId: map.id, version: (latest?.value ?? 0) + 1, createdAt: now, ...values })
        .$returningId(),
    );
    await tx.update(maps).set({ currentVersionId: versionId }).where(eq(maps.id, map.id));
    return { versionId, createdNewVersion: true };
  });
}

export type LeaderboardEntry = {
  rank: number;
  runId: number;
  userId: number;
  username: string;
  gold: number;
  steps: number;
  outcomeKind: string;
  createdAt: number;
};

export async function leaderboard(db: Db, mapVersionId: number): Promise<LeaderboardEntry[]> {
  const ranked = db
    .select({
      runId: runs.id,
      userId: runs.userId,
      gold: runs.gold,
      steps: runs.steps,
      outcomeKind: runs.outcomeKind,
      createdAt: runs.createdAt,
      best: sql<number>`row_number() over (
        partition by ${runs.userId}
        order by ${runs.gold} desc, ${runs.steps} asc, ${runs.createdAt} asc, ${runs.id} asc
      )`.as("best"),
    })
    .from(runs)
    .where(eq(runs.mapVersionId, mapVersionId))
    .as("ranked");
  const rows = await db
    .select({
      runId: ranked.runId,
      userId: ranked.userId,
      username: users.username,
      gold: ranked.gold,
      steps: ranked.steps,
      outcomeKind: ranked.outcomeKind,
      createdAt: ranked.createdAt,
    })
    .from(ranked)
    .innerJoin(users, eq(users.id, ranked.userId))
    .where(eq(ranked.best, 1))
    .orderBy(desc(ranked.gold), asc(ranked.steps), asc(ranked.createdAt), asc(ranked.runId));
  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

export async function mapBelongsToVersion(
  db: Db,
  mapId: number,
  versionId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: mapVersions.id })
    .from(mapVersions)
    .where(and(eq(mapVersions.id, versionId), eq(mapVersions.mapId, mapId)))
    .limit(1);
  return row !== undefined;
}
