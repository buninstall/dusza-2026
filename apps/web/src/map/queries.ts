import { queryOptions } from "@tanstack/react-query";
import { api, call } from "../lib/api.ts";

export type MapScope = "all" | "mine";

export const mapsQuery = (scope: MapScope) =>
  queryOptions({
    queryKey: ["maps", scope],
    queryFn: () => call(api.maps.$get({ query: { scope } })),
  });

export const mapQuery = (mapId: number) =>
  queryOptions({
    queryKey: ["map", mapId],
    queryFn: () => call(api.maps[":id"].$get({ param: { id: String(mapId) } })),
  });

export const leaderboardQuery = (mapId: number, versionId?: number) =>
  queryOptions({
    queryKey: ["leaderboard", mapId, versionId ?? "current"],
    queryFn: () =>
      call(
        api.maps[":id"].leaderboard.$get({
          param: { id: String(mapId) },
          query: versionId === undefined ? {} : { version: String(versionId) },
        }),
      ),
  });

export type MapDetail = Awaited<ReturnType<NonNullable<ReturnType<typeof mapQuery>["queryFn"]>>>;
