import type { MapSummary } from "./queries.ts";

export const MAP_SORTS = ["order", "size", "gold", "recent", "popular"] as const;

export type MapSort = (typeof MAP_SORTS)[number];

const COMPARE: Record<MapSort, (a: MapSummary, b: MapSummary) => number> = {
  order: (a, b) => a.createdAt - b.createdAt || a.id - b.id,
  size: (a, b) => b.rows * b.cols - a.rows * a.cols || a.id - b.id,
  gold: (a, b) => b.goldTotal - a.goldTotal || a.id - b.id,
  recent: (a, b) => b.updatedAt - a.updatedAt || b.id - a.id,
  popular: (a, b) => b.favoriteCount - a.favoriteCount || b.updatedAt - a.updatedAt || b.id - a.id,
};

export function sortMaps(maps: readonly MapSummary[], sort: MapSort): MapSummary[] {
  return [...maps].sort(COMPARE[sort]);
}
