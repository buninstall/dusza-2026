import {
  keepPreviousData,
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "../components/ui/Toast.tsx";
import { browse } from "../i18n/hu-browse.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import type { DifficultyFilter } from "./mode.ts";
import type { MapSort } from "./sort.ts";

export type MapScope = "all" | "mine" | "favorites";

export const SANDBOX_PAGE_SIZE = 8;

export type SandboxParams = {
  scope: MapScope;
  q: string;
  sort: MapSort;
  level: DifficultyFilter;
  page: number;
};

const fetchSandboxPage = (params: SandboxParams, pageSize = SANDBOX_PAGE_SIZE) =>
  call(
    api.maps.$get({
      query: {
        world: "sandbox",
        scope: params.scope,
        q: params.q,
        sort: params.sort,
        level: params.level,
        page: String(params.page),
        pageSize: String(pageSize),
      },
    }),
  );

const fetchStoryMaps = () => call(api.maps.story.$get());

const fetchSandboxStats = () => call(api.maps.stats.$get());

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

export type MapPage = Awaited<ReturnType<typeof fetchSandboxPage>>;
export type StoryList = Awaited<ReturnType<typeof fetchStoryMaps>>;
export type DailyChallenge = Awaited<ReturnType<typeof fetchDaily>>;
export type MapSummary = MapPage["maps"][number];
export type MapDetail = Awaited<ReturnType<typeof fetchMap>>;
export type Leaderboard = Awaited<ReturnType<typeof fetchLeaderboard>>;
export type StoryBoard = Awaited<ReturnType<typeof fetchStoryBoard>>;

const SANDBOX_KEY = ["maps", "sandbox"] as const;
const STATS_STALE_MS = 30_000;

export const sandboxQuery = (params: SandboxParams) =>
  queryOptions({
    queryKey: [...SANDBOX_KEY, params],
    queryFn: () => fetchSandboxPage(params),
    placeholderData: keepPreviousData,
  });

export const firstSandboxMapQuery = () =>
  queryOptions({
    queryKey: [...SANDBOX_KEY, "first"],
    queryFn: () =>
      fetchSandboxPage({ scope: "all", q: "", sort: "order", level: "all", page: 1 }, 1),
  });

export const storyMapsQuery = () =>
  queryOptions({ queryKey: ["maps", "story"], queryFn: fetchStoryMaps });

export const sandboxStatsQuery = () =>
  queryOptions({
    queryKey: ["maps", "stats"],
    queryFn: fetchSandboxStats,
    staleTime: STATS_STALE_MS,
  });

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

export function prefetchSandboxPage(queryClient: QueryClient, params: SandboxParams): void {
  void queryClient.prefetchQuery(sandboxQuery(params));
}

type FavoriteInput = { mapId: number; title: string; isFavorite: boolean };

function patchPages(
  queryClient: QueryClient,
  mapId: number,
  patch: (map: MapSummary) => MapSummary,
): void {
  queryClient.setQueriesData<MapPage>({ queryKey: SANDBOX_KEY }, (page) =>
    page && Array.isArray(page.maps)
      ? { ...page, maps: page.maps.map((map) => (map.id === mapId ? patch(map) : map)) }
      : page,
  );
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mapId, isFavorite }: FavoriteInput) => {
      const param = { param: { id: String(mapId) } };
      return call(
        isFavorite ? api.maps[":id"].favorite.$put(param) : api.maps[":id"].favorite.$delete(param),
      );
    },
    onMutate: async ({ mapId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: SANDBOX_KEY });
      const snapshot = queryClient.getQueriesData<MapPage>({ queryKey: SANDBOX_KEY });
      patchPages(queryClient, mapId, (map) =>
        map.isFavorite === isFavorite
          ? map
          : {
              ...map,
              isFavorite,
              favoriteCount: Math.max(0, map.favoriteCount + (isFavorite ? 1 : -1)),
            },
      );
      return { snapshot };
    },
    onError: (error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error(errorMessage(error, browse.favoriteFailed));
    },
    onSuccess: (state, { mapId, title }) => {
      patchPages(queryClient, mapId, (map) => ({ ...map, ...state }));
      toast.success(state.isFavorite ? browse.favoriteAdded(title) : browse.favoriteRemoved(title));
    },
    onSettled: (_state, _error, { mapId }) => {
      void queryClient.invalidateQueries({ queryKey: SANDBOX_KEY });
      void queryClient.invalidateQueries({ queryKey: ["map", mapId] });
    },
  });
}
