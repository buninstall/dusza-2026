import type { Diagnostic, Engine, MapInfo, MineMap } from "@minescript/engine";
import { and, asc, count, eq, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { type MapRow, type MapVersionRow, maps, mapVersions, runs, users } from "../db/schema.ts";
import type { SessionUser } from "../env.ts";
import { sha256Hex } from "../lib/crypto.ts";

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
  return map.ownerId === user.id || user.role === "admin";
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

export function findMap(db: Db, id: number): MapRow | undefined {
  return db.select().from(maps).where(eq(maps.id, id)).get();
}

export function findVersion(db: Db, id: number): MapVersionRow | undefined {
  return db.select().from(mapVersions).where(eq(mapVersions.id, id)).get();
}

export function currentVersion(db: Db, map: MapRow): MapVersionRow | undefined {
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
    .orderBy(asc(mapVersions.version))
    .all();
}

export function runCount(db: Db, mapVersionId: number): number {
  const row = db
    .select({ value: count() })
    .from(runs)
    .where(eq(runs.mapVersionId, mapVersionId))
    .get();
  return row?.value ?? 0;
}

export function listMaps(db: Db, user: SessionUser, scope: "all" | "mine") {
  return db
    .select({
      id: maps.id,
      title: maps.title,
      description: maps.description,
      visibility: maps.visibility,
      ownerId: maps.ownerId,
      ownerName: users.username,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
      versionId: mapVersions.id,
      version: mapVersions.version,
      content: mapVersions.content,
      rows: mapVersions.rows,
      cols: mapVersions.cols,
      goldTotal: mapVersions.goldTotal,
      reachableGold: mapVersions.reachableGold,
    })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .innerJoin(mapVersions, eq(mapVersions.id, maps.currentVersionId))
    .where(visibleTo(user, scope))
    .orderBy(asc(maps.createdAt), asc(maps.id))
    .all();
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
  },
): MapRow {
  return db.transaction((tx) => {
    const created = tx
      .insert(maps)
      .values({
        ownerId: input.ownerId,
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .returning()
      .get();
    const version = tx
      .insert(mapVersions)
      .values({
        mapId: created.id,
        version: 1,
        createdAt: input.now,
        ...versionValues(input.valid),
      })
      .returning()
      .get();
    return tx
      .update(maps)
      .set({ currentVersionId: version.id })
      .where(eq(maps.id, created.id))
      .returning()
      .get();
  });
}

export function replaceContent(
  db: Db,
  map: MapRow,
  valid: ValidMapContent,
  now: number,
): { versionId: number; createdNewVersion: boolean } {
  const current = currentVersion(db, map);
  const values = versionValues(valid);
  if (current && current.contentHash === values.contentHash) {
    return { versionId: current.id, createdNewVersion: false };
  }
  if (current && runCount(db, current.id) === 0) {
    db.update(mapVersions).set(values).where(eq(mapVersions.id, current.id)).run();
    return { versionId: current.id, createdNewVersion: false };
  }
  return db.transaction((tx) => {
    const latest = tx
      .select({ value: sql<number>`coalesce(max(${mapVersions.version}), 0)` })
      .from(mapVersions)
      .where(eq(mapVersions.mapId, map.id))
      .get();
    const version = tx
      .insert(mapVersions)
      .values({ mapId: map.id, version: (latest?.value ?? 0) + 1, createdAt: now, ...values })
      .returning()
      .get();
    tx.update(maps).set({ currentVersionId: version.id }).where(eq(maps.id, map.id)).run();
    return { versionId: version.id, createdNewVersion: true };
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

type LeaderboardRow = Omit<LeaderboardEntry, "rank">;

export function leaderboard(db: Db, mapVersionId: number): LeaderboardEntry[] {
  const rows = db.all<LeaderboardRow>(sql`
    SELECT ranked.id AS runId, ranked.user_id AS userId, u.username AS username,
      ranked.gold AS gold, ranked.steps AS steps, ranked.outcome_kind AS outcomeKind,
      ranked.created_at AS createdAt
    FROM (
      SELECT r.*, ROW_NUMBER() OVER (
        PARTITION BY r.user_id ORDER BY r.gold DESC, r.steps ASC, r.created_at ASC, r.id ASC
      ) AS best
      FROM ${runs} r
      WHERE r.map_version_id = ${mapVersionId}
    ) ranked
    JOIN ${users} u ON u.id = ranked.user_id
    WHERE ranked.best = 1
    ORDER BY ranked.gold DESC, ranked.steps ASC, ranked.created_at ASC, ranked.id ASC
  `);
  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

export function mapBelongsToVersion(db: Db, mapId: number, versionId: number): boolean {
  const row = db
    .select({ id: mapVersions.id })
    .from(mapVersions)
    .where(and(eq(mapVersions.id, versionId), eq(mapVersions.mapId, mapId)))
    .get();
  return row !== undefined;
}
