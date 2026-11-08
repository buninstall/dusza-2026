import { CHAPTERS, type Chapter, type StratumId } from "../i18n/hu-story.ts";
import type { MapSummary } from "./queries.ts";

export const STRATUM_INDEX: Record<StratumId, number> = {
  clay: 1,
  limestone: 2,
  amethyst: 3,
  iron: 4,
  emerald: 5,
  obsidian: 6,
};

export const CORE_STRATUM = 7;
const CLEARED_STARS = 2;

export type ChapterGroup = {
  chapter: Chapter;
  maps: MapSummary[];
  cleared: number;
  isComplete: boolean;
  hasDiary: boolean;
  lock: { previous: Chapter; remaining: number; isChained: boolean } | null;
};

export type Campaign = {
  groups: ChapterGroup[];
  isSilent: boolean;
  lockedIds: ReadonlySet<number>;
};

export function isCampaignMap(map: MapSummary): boolean {
  return map.isStory;
}

export function isCleared(map: MapSummary): boolean {
  return map.stars === null || map.stars >= CLEARED_STARS;
}

function chapterIndex(): Map<string, number> {
  const index = new Map<string, number>();
  CHAPTERS.forEach((chapter, at) => {
    for (const title of chapter.levels) index.set(title, at);
  });
  return index;
}

function bucketize(ordered: readonly MapSummary[]): MapSummary[][] {
  const index = chapterIndex();
  const buckets = CHAPTERS.map((): MapSummary[] => []);
  const taken = new Set<string>();
  for (const map of ordered) {
    const at = map.isStory ? index.get(map.title) : undefined;
    const bucket = at === undefined ? undefined : buckets[at];
    if (bucket && !taken.has(map.title)) {
      taken.add(map.title);
      bucket.push(map);
    }
  }
  return buckets;
}

export function groupCampaign(ordered: readonly MapSummary[]): Campaign {
  const buckets = bucketize(ordered);
  const groups: ChapterGroup[] = [];
  let owed = 0;
  for (const [at, chapter] of CHAPTERS.entries()) {
    const maps = buckets[at] ?? [];
    if (maps.length === 0) {
      continue;
    }
    const previous = groups.at(-1);
    const cleared = maps.filter(isCleared).length;
    const isOpen = !previous || (previous.lock === null && previous.isComplete);
    groups.push({
      chapter,
      maps,
      cleared,
      isComplete: maps.length === chapter.levels.length && cleared === maps.length,
      hasDiary: maps.some((map) => (map.stars ?? 0) >= 1),
      lock:
        isOpen || !previous
          ? null
          : {
              previous: previous.chapter,
              remaining: owed,
              isChained: previous.lock !== null,
            },
    });
    owed += Math.max(0, chapter.levels.length - cleared);
  }
  const last = groups.at(-1);
  const finalTitle = CHAPTERS.at(-1)?.levels.at(-1);
  const finalMap =
    last && last.lock === null && last.chapter === CHAPTERS.at(-1)
      ? last.maps.find((map) => map.title === finalTitle)
      : undefined;
  return {
    groups,
    isSilent: finalMap ? isCleared(finalMap) : false,
    lockedIds: new Set(groups.flatMap((group) => (group.lock ? group.maps.map((m) => m.id) : []))),
  };
}
