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
  hasDiary: boolean;
  hasFinding: boolean;
};

export type Campaign = {
  groups: ChapterGroup[];
  others: MapSummary[];
  isSilent: boolean;
};

export function isCleared(map: MapSummary): boolean {
  return map.stars === null || map.stars >= CLEARED_STARS;
}

function chapterOf(): Map<string, number> {
  const index = new Map<string, number>();
  CHAPTERS.forEach((chapter, chapterIndex) => {
    for (const title of chapter.levels) index.set(title, chapterIndex);
  });
  return index;
}

export function groupCampaign(ordered: readonly MapSummary[]): Campaign {
  const index = chapterOf();
  const buckets = CHAPTERS.map((): MapSummary[] => []);
  const taken = new Set<string>();
  const others: MapSummary[] = [];
  for (const map of ordered) {
    const chapterIndex = index.get(map.title);
    const bucket = chapterIndex === undefined ? undefined : buckets[chapterIndex];
    if (bucket && !taken.has(map.title)) {
      taken.add(map.title);
      bucket.push(map);
    } else {
      others.push(map);
    }
  }
  const groups = CHAPTERS.flatMap((chapter, chapterIndex): ChapterGroup[] => {
    const maps = buckets[chapterIndex] ?? [];
    if (maps.length === 0) {
      return [];
    }
    const cleared = maps.filter(isCleared).length;
    return [
      {
        chapter,
        maps,
        cleared,
        hasDiary: maps.some((map) => (map.stars ?? 0) >= 1),
        hasFinding: maps.length === chapter.levels.length && cleared === maps.length,
      },
    ];
  });
  const last = CHAPTERS.at(-1);
  const heart = last ? groups.find((group) => group.chapter === last) : undefined;
  const finalTitle = last?.levels.at(-1);
  const finalMap = heart?.maps.find((map) => map.title === finalTitle);
  return { groups, others, isSilent: finalMap ? isCleared(finalMap) : false };
}
