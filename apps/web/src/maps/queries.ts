import { queryOptions } from "@tanstack/react-query";
import { api, call } from "../lib/api.ts";

export type MapScope = "all" | "mine";

const fetchMaps = (scope: MapScope) => call(api.maps.$get({ query: { scope } }));

const fetchMap = (mapId: number) => call(api.maps[":id"].$get({ param: { id: String(mapId) } }));

const fetchLeaderboard = (mapId: number, versionId: number | undefined) =>
  call(
    api.maps[":id"].leaderboard.$get({
      param: { id: String(mapId) },
      query: versionId === undefined ? {} : { version: String(versionId) },
    }),
  );

const fetchDaily = () => call(api.maps.daily.$get());

const fetchStoryBoard = () => call(api.story.leaderboard.$get());

export type MapList = Awaited<ReturnType<typeof fetchMaps>>;
export type DailyChallenge = Awaited<ReturnType<typeof fetchDaily>>;
export type MapSummary = MapList["maps"][number];
export type MapDetail = Awaited<ReturnType<typeof fetchMap>>;
export type Leaderboard = Awaited<ReturnType<typeof fetchLeaderboard>>;
export type StoryBoard = Awaited<ReturnType<typeof fetchStoryBoard>>;

export const mapsQuery = (scope: MapScope) =>
  queryOptions({ queryKey: ["maps", scope], queryFn: () => fetchMaps(scope) });

export const mapQuery = (mapId: number) =>
  queryOptions({ queryKey: ["map", mapId], queryFn: () => fetchMap(mapId) });

export const leaderboardQuery = (mapId: number, versionId?: number) =>
  queryOptions({
    queryKey: ["leaderboard", mapId, versionId ?? "current"],
    queryFn: () => fetchLeaderboard(mapId, versionId),
  });

export const dailyQuery = () =>
  queryOptions({ queryKey: ["maps", "daily"], queryFn: fetchDaily, staleTime: 60_000 });

export const storyBoardQuery = () =>
  queryOptions({ queryKey: ["story", "leaderboard"], queryFn: fetchStoryBoard });
