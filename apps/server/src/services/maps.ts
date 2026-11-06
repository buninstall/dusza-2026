import type { Diagnostic, Engine, MapInfo, MineMap } from "@minescript/engine";
import { and, asc, count, desc, eq, isNull, max, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { firstRow } from "../db/rows.ts";
import {
  type MapRow,
  type MapVersionRow,
  mapLikes,
  maps,
  mapVersions,
  runs,
  users,
} from "../db/schema.ts";
import type { SessionUser } from "../env.ts";
import { sha256Hex } from "../lib/crypto.ts";
import { bestRunsOf, likeCounts, progressOf } from "./progress.ts";

export type ValidMapContent = {
  ok: true;
  canonical: string;
  map: MineMap;
  info: MapInfo;
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
  return {
    ok: true,
    canonical: engine.serializeMap(parsed.map),
    map: parsed.map,
    info: engine.mapInfo(parsed.map),
    warnings: parsed.diagnostics,
  };
}

export function versionValues(valid: ValidMapContent) {
  return {
    content: valid.canonical,
    contentHash: sha256Hex(valid.canonical),
    rows: valid.map.rows,
    cols: valid.map.cols,
    goldTotal: valid.info.goldTotal,
    reachableGold: valid.info.reachableGold,
  };
}

export function canView(user: SessionUser, map: MapRow): boolean {
  return map.visibility === "public" || map.ownerId === user.id || user.role === "admin";
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

export async function mapSummaries(db: Db, user: SessionUser, filter: SQL | undefined) {
  const mine = bestRunsOf(db, user.id);
  const liked = likeCounts(db);
  const rows = await db
    .select({
      id: maps.id,
      title: maps.title,
      description: maps.description,
      visibility: maps.visibility,
      ownerId: maps.ownerId,
      ownerName: users.username,
      parSteps: maps.parSteps,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
      versionId: mapVersions.id,
      version: mapVersions.version,
      content: mapVersions.content,
      rows: mapVersions.rows,
      cols: mapVersions.cols,
      goldTotal: mapVersions.goldTotal,
      reachableGold: mapVersions.reachableGold,
      bestGold: mine.gold,
      bestSteps: mine.steps,
      likes: liked.likes,
      likedByMe: sql<number>`exists(
        select 1 from ${mapLikes}
        where ${mapLikes.mapId} = ${maps.id} and ${mapLikes.userId} = ${user.id}
      )`,
    })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .innerJoin(mapVersions, eq(mapVersions.id, maps.currentVersionId))
    .leftJoin(mine, and(eq(mine.mapVersionId, mapVersions.id), eq(mine.position, 1)))
    .leftJoin(liked, eq(liked.mapId, maps.id))
    .where(filter)
    .orderBy(asc(maps.createdAt), asc(maps.id));
  return rows.map(({ bestGold, bestSteps, likes, likedByMe, ...row }) => ({
    ...row,
    likes: Number(likes ?? 0),
    likedByMe: Number(likedByMe) === 1,
    ...progressOf(
      bestGold === null || bestSteps === null ? null : { gold: bestGold, steps: bestSteps },
      row.reachableGold,
      row.parSteps,
    ),
  }));
}

export function listMaps(db: Db, user: SessionUser, scope: "all" | "mine") {
  return mapSummaries(db, user, and(isNull(maps.dailyDate), visibleTo(user, scope)));
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
