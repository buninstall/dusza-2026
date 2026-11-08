import type { Engine } from "@minescript/engine";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  min,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { type MapRow, mapFavorites, maps, mapVersions, users } from "../db/schema.ts";
import type { SessionUser } from "../env.ts";
import {
  containsPattern,
  offsetOf,
  type PageMeta,
  type PageRequest,
  pageMeta,
} from "../lib/paging.ts";
import { TUTORIAL_MAPS } from "../seed/maps.ts";
import { difficultyOf } from "./generator.ts";
import { canonicalHash, markedDifficulty, visibleTo } from "./maps.ts";
import { bestScoresOf, progressOf } from "./progress.ts";

export const MAP_WORLDS = ["all", "sandbox", "story"] as const;
export const MAP_SCOPES = ["all", "mine", "favorites"] as const;
export const MAP_SORTS = ["order", "recent", "size", "gold", "popular"] as const;
export const LEVEL_FILTERS = ["all", "easy", "medium", "hard"] as const;

export type MapWorld = (typeof MAP_WORLDS)[number];
export type MapScope = (typeof MAP_SCOPES)[number];
export type MapSort = (typeof MAP_SORTS)[number];
export type LevelFilter = (typeof LEVEL_FILTERS)[number];

export type MapListQuery = PageRequest & {
  world: MapWorld;
  scope: MapScope;
  q: string;
  sort: MapSort;
  level: LevelFilter;
};

const STORY_TITLE_LIST = TUTORIAL_MAPS.map((tutorial) => tutorial.title);
const STORY_TITLES = new Set(STORY_TITLE_LIST);
const STORY_LIMIT = STORY_TITLE_LIST.length * 4;

function storyCondition(): SQL {
  return sql`(${eq(users.role, "admin")} and ${inArray(maps.title, STORY_TITLE_LIST)})`;
}

export async function ownsStoryMaps(db: Db, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .where(and(eq(maps.ownerId, userId), storyCondition()));
  return (row?.value ?? 0) > 0;
}

function worldCondition(world: MapWorld): SQL | undefined {
  if (world === "story") {
    return storyCondition();
  }
  return world === "sandbox" ? not(storyCondition()) : undefined;
}

function searchCondition(q: string): SQL | undefined {
  if (q.length === 0) {
    return undefined;
  }
  const pattern = containsPattern(q);
  return or(
    like(maps.title, pattern),
    like(users.username, pattern),
    like(maps.description, pattern),
  );
}

function favoritesOf(db: Db, userId: number) {
  return db
    .select({ mapId: mapFavorites.mapId })
    .from(mapFavorites)
    .where(eq(mapFavorites.userId, userId));
}

function listFilter(db: Db, user: SessionUser, query: MapListQuery): SQL | undefined {
  return and(
    isNull(maps.dailyDate),
    worldCondition(query.world),
    visibleTo(user, query.scope === "mine" ? "mine" : "all"),
    query.scope === "favorites" ? inArray(maps.id, favoritesOf(db, user.id)) : undefined,
    query.level === "all" ? undefined : eq(mapVersions.difficulty, query.level),
    searchCondition(query.q),
  );
}

function orderOf(sort: MapSort): SQL[] {
  switch (sort) {
    case "order":
      return [asc(maps.createdAt), asc(maps.id)];
    case "size":
      return [desc(sql`${mapVersions.rows} * ${mapVersions.cols}`), asc(maps.id)];
    case "gold":
      return [desc(mapVersions.goldTotal), asc(maps.id)];
    case "popular":
      return [desc(maps.favoriteCount), desc(maps.updatedAt), desc(maps.id)];
    default:
      return [desc(maps.updatedAt), desc(maps.id)];
  }
}

function selectSummaries(db: Db) {
  return db
    .select({
      id: maps.id,
      title: maps.title,
      description: maps.description,
      visibility: maps.visibility,
      ownerId: maps.ownerId,
      ownerName: users.username,
      ownerRole: users.role,
      parSteps: maps.parSteps,
      lampMode: maps.lampMode,
      favoriteCount: maps.favoriteCount,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
      versionId: mapVersions.id,
      version: mapVersions.version,
      content: mapVersions.content,
      contentHash: mapVersions.contentHash,
      rows: mapVersions.rows,
      cols: mapVersions.cols,
      goldTotal: mapVersions.goldTotal,
      reachableGold: mapVersions.reachableGold,
      difficulty: mapVersions.difficulty,
    })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .innerJoin(mapVersions, eq(mapVersions.id, maps.currentVersionId));
}

type SummaryRow = Awaited<ReturnType<typeof selectSummaries>>[number];

async function favoriteIdsOf(
  db: Db,
  userId: number,
  mapIds: readonly number[],
): Promise<Set<number>> {
  if (mapIds.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({ mapId: mapFavorites.mapId })
    .from(mapFavorites)
    .where(and(eq(mapFavorites.userId, userId), inArray(mapFavorites.mapId, [...mapIds])));
  return new Set(rows.map((row) => row.mapId));
}

async function decorate(db: Db, engine: Engine, user: SessionUser, rows: readonly SummaryRow[]) {
  const [best, favorites] = await Promise.all([
    bestScoresOf(
      db,
      user.id,
      rows.map((row) => row.versionId),
    ),
    favoriteIdsOf(
      db,
      user.id,
      rows.map((row) => row.id),
    ),
  ]);
  return rows.map(({ contentHash, ownerRole, difficulty, ...row }) => ({
    ...row,
    isStory: ownerRole === "admin" && STORY_TITLES.has(row.title),
    isFavorite: favorites.has(row.id),
    difficulty:
      difficulty === null
        ? difficultyOf(engine, row.content, contentHash)
        : markedDifficulty(difficulty),
    ...progressOf(best.get(row.versionId) ?? null, row.reachableGold, row.parSteps),
  }));
}

export type MapSummary = Awaited<ReturnType<typeof decorate>>[number];

export type MapPage = PageMeta & { maps: MapSummary[] };

export async function listMapPage(
  db: Db,
  engine: Engine,
  user: SessionUser,
  query: MapListQuery,
): Promise<MapPage> {
  const filter = listFilter(db, user, query);
  const [counted] = await db
    .select({ value: count() })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .innerJoin(mapVersions, eq(mapVersions.id, maps.currentVersionId))
    .where(filter);
  const meta = pageMeta(query, counted?.value ?? 0);
  if (meta.total === 0) {
    return { ...meta, maps: [] };
  }
  const rows = await selectSummaries(db)
    .where(filter)
    .orderBy(...orderOf(query.sort))
    .limit(meta.pageSize)
    .offset(offsetOf(meta));
  return { ...meta, maps: await decorate(db, engine, user, rows) };
}

export async function storyMaps(db: Db, engine: Engine, user: SessionUser) {
  const rows = await selectSummaries(db)
    .where(and(isNull(maps.dailyDate), storyCondition(), visibleTo(user, "all")))
    .orderBy(asc(maps.createdAt), asc(maps.id))
    .limit(STORY_LIMIT);
  return decorate(db, engine, user, rows);
}

export async function summaryOf(db: Db, engine: Engine, user: SessionUser, mapId: number) {
  const rows = await selectSummaries(db).where(eq(maps.id, mapId)).limit(1);
  const [summary] = await decorate(db, engine, user, rows);
  return summary;
}

export async function sandboxStats(db: Db, user: SessionUser) {
  const [row] = await db
    .select({ maps: count(), authors: countDistinct(maps.ownerId) })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .where(and(isNull(maps.dailyDate), not(storyCondition()), visibleTo(user, "all")));
  return { maps: row?.maps ?? 0, authors: row?.authors ?? 0 };
}

export type NextMap = { id: number; title: string };

async function isStoryMap(db: Db, map: MapRow): Promise<boolean> {
  if (!STORY_TITLES.has(map.title)) {
    return false;
  }
  const [owner] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, map.ownerId))
    .limit(1);
  return owner?.role === "admin";
}

async function nextStoryMap(db: Db, user: SessionUser, map: MapRow): Promise<NextMap | null> {
  const rows = await db
    .select({ id: maps.id, title: maps.title })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .where(and(isNull(maps.dailyDate), storyCondition(), visibleTo(user, "all")))
    .orderBy(asc(maps.createdAt), asc(maps.id))
    .limit(STORY_LIMIT);
  const here = STORY_TITLE_LIST.indexOf(map.title);
  const later = rows
    .map((row) => ({ ...row, at: STORY_TITLE_LIST.indexOf(row.title) }))
    .filter((row) => row.at > here)
    .sort((a, b) => a.at - b.at || a.id - b.id);
  const [next] = later;
  return next ? { id: next.id, title: next.title } : null;
}

export async function nextMap(db: Db, user: SessionUser, map: MapRow): Promise<NextMap | null> {
  if (map.dailyDate !== null) {
    return null;
  }
  if (await isStoryMap(db, map)) {
    return nextStoryMap(db, user, map);
  }
  const [next] = await db
    .select({ id: maps.id, title: maps.title })
    .from(maps)
    .innerJoin(users, eq(users.id, maps.ownerId))
    .where(
      and(
        isNull(maps.dailyDate),
        not(storyCondition()),
        visibleTo(user, "all"),
        or(
          gt(maps.createdAt, map.createdAt),
          and(eq(maps.createdAt, map.createdAt), gt(maps.id, map.id)),
        ),
      ),
    )
    .orderBy(asc(maps.createdAt), asc(maps.id))
    .limit(1);
  return next ?? null;
}

export async function matchContents(
  db: Db,
  engine: Engine,
  user: SessionUser,
  contents: readonly string[],
): Promise<(number | null)[]> {
  const hashes = contents.map((content) => canonicalHash(engine, content));
  const wanted = [...new Set(hashes.filter((hash): hash is string => hash !== null))];
  if (wanted.length === 0) {
    return hashes.map(() => null);
  }
  const rows = await db
    .select({ hash: mapVersions.contentHash, id: min(maps.id) })
    .from(maps)
    .innerJoin(mapVersions, eq(mapVersions.id, maps.currentVersionId))
    .where(
      and(isNull(maps.dailyDate), visibleTo(user, "all"), inArray(mapVersions.contentHash, wanted)),
    )
    .groupBy(mapVersions.contentHash);
  const byHash = new Map(rows.map((row) => [row.hash, row.id]));
  return hashes.map((hash) => (hash === null ? null : (byHash.get(hash) ?? null)));
}
