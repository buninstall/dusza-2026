import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { maps, mapVersions, runs, users } from "../db/schema.ts";
import { TUTORIAL_MAPS } from "../seed/maps.ts";
import { MAX_STARS, starsFor } from "./stars.ts";

export const LEVELS_PER_CHAPTER = 5;
const CLEARED_STARS = 2;

type CampaignLevel = {
  index: number;
  versionId: number;
  reachableGold: number;
  parSteps: number | null;
};

export type StoryEntry = {
  rank: number;
  userId: number;
  username: string;
  stars: number;
  gold: number;
  steps: number;
  cleared: number;
  chapter: number;
};

export type StoryBoard = { maxStars: number; chapters: number; entries: StoryEntry[] };

async function campaignLevels(db: Db): Promise<CampaignLevel[]> {
  const titles = TUTORIAL_MAPS.map((tutorial) => tutorial.title);
  const rows = await db
    .select({
      id: maps.id,
      title: maps.title,
      parSteps: maps.parSteps,
      versionId: mapVersions.id,
      reachableGold: mapVersions.reachableGold,
    })
    .from(maps)
    .innerJoin(mapVersions, eq(mapVersions.id, maps.currentVersionId))
    .innerJoin(users, eq(users.id, maps.ownerId))
    .where(and(inArray(maps.title, titles), isNull(maps.dailyDate), eq(users.role, "admin")))
    .orderBy(asc(maps.id));
  const byTitle = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!byTitle.has(row.title)) byTitle.set(row.title, row);
  }
  return titles.flatMap((title, index) => {
    const row = byTitle.get(title);
    return row
      ? [
          {
            index,
            versionId: row.versionId,
            reachableGold: row.reachableGold,
            parSteps: row.parSteps,
          },
        ]
      : [];
  });
}

async function bestRuns(db: Db, versionIds: readonly number[]) {
  if (versionIds.length === 0) {
    return [];
  }
  const ranked = db
    .select({
      userId: runs.userId,
      mapVersionId: runs.mapVersionId,
      gold: runs.gold,
      steps: runs.steps,
      position: sql<number>`row_number() over (
        partition by ${runs.userId}, ${runs.mapVersionId}
        order by ${runs.gold} desc, ${runs.steps} asc, ${runs.createdAt} asc, ${runs.id} asc
      )`.as("position"),
    })
    .from(runs)
    .where(inArray(runs.mapVersionId, [...versionIds]))
    .as("ranked");
  return db
    .select({
      userId: ranked.userId,
      username: users.username,
      mapVersionId: ranked.mapVersionId,
      gold: ranked.gold,
      steps: ranked.steps,
    })
    .from(ranked)
    .innerJoin(users, eq(users.id, ranked.userId))
    .where(eq(ranked.position, 1));
}

export function chapterReached(clearedByIndex: ReadonlySet<number>, levelCount: number): number {
  const chapters = Math.ceil(levelCount / LEVELS_PER_CHAPTER);
  let chapter = 1;
  while (chapter < chapters) {
    const start = (chapter - 1) * LEVELS_PER_CHAPTER;
    const end = Math.min(levelCount, start + LEVELS_PER_CHAPTER);
    for (let index = start; index < end; index += 1) {
      if (!clearedByIndex.has(index)) {
        return chapter;
      }
    }
    chapter += 1;
  }
  return chapter;
}

type Tally = Omit<StoryEntry, "rank" | "chapter"> & { clearedIndexes: Set<number> };

export async function storyLeaderboard(db: Db): Promise<StoryBoard> {
  const levels = await campaignLevels(db);
  const byVersion = new Map(levels.map((level) => [level.versionId, level]));
  const tallies = new Map<number, Tally>();
  for (const run of await bestRuns(db, [...byVersion.keys()])) {
    const level = byVersion.get(run.mapVersionId);
    if (!level || run.gold <= 0) {
      continue;
    }
    const tally = tallies.get(run.userId) ?? {
      userId: run.userId,
      username: run.username,
      stars: 0,
      gold: 0,
      steps: 0,
      cleared: 0,
      clearedIndexes: new Set<number>(),
    };
    const stars = starsFor(run, level.reachableGold, level.parSteps) ?? 0;
    tally.stars += stars;
    tally.gold += run.gold;
    tally.steps += run.steps;
    if (stars >= CLEARED_STARS) {
      tally.cleared += 1;
      tally.clearedIndexes.add(level.index);
    }
    tallies.set(run.userId, tally);
  }
  const entries = [...tallies.values()]
    .map(({ clearedIndexes, ...tally }) => ({
      ...tally,
      chapter: chapterReached(clearedIndexes, levels.length),
    }))
    .sort(
      (a, b) =>
        b.stars - a.stars ||
        b.gold - a.gold ||
        a.steps - b.steps ||
        a.username.localeCompare(b.username),
    )
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  return {
    maxStars: levels.length * MAX_STARS,
    chapters: Math.ceil(levels.length / LEVELS_PER_CHAPTER),
    entries,
  };
}
