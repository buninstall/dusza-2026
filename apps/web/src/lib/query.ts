import {
  type DehydratedState,
  dehydrate,
  hydrate,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { ApiError } from "./api.ts";

const MAX_RETRIES = 2;
const STALE_MS = 60_000;
const KEEP_MS = 30 * 60_000;
const CACHE_KEY = "minescript.query-cache.v1";
const CACHE_AGE_MS = 10 * 60_000;
const PERSISTED = new Set(["maps", "map", "leaderboard", "programs", "my-runs"]);
export const RECOVER_MS = 4000;
export const INLINE_META = { isInline: true } as const;

export function isInlineQuery(meta: Record<string, unknown> | undefined): boolean {
  const { isInline } = meta ?? {};
  return isInline === true;
}

const SERVER_ERROR = 500;

export function isServerTrouble(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= SERVER_ERROR);
}

const UNAUTHORIZED = 401;

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === UNAUTHORIZED;
}

export function createQueryClient(onUnauthorized: () => void = () => {}): QueryClient {
  const handle = (error: unknown) => {
    if (isUnauthorized(error)) {
      onUnauthorized();
    }
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        gcTime: KEEP_MS,
        refetchOnWindowFocus: false,
        refetchInterval: (query) => (isServerTrouble(query.state.error) ? RECOVER_MS : false),
        retry: (failureCount, error) =>
          !isServerTrouble(error) &&
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < MAX_RETRIES,
      },
    },
  });
}

type Snapshot = { at: number; state: DehydratedState };

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object" || !("at" in value) || !("state" in value)) return false;
  const { at, state } = value;
  return (
    typeof at === "number" &&
    typeof state === "object" &&
    state !== null &&
    "queries" in state &&
    Array.isArray(state.queries) &&
    "mutations" in state &&
    Array.isArray(state.mutations)
  );
}

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function clearPersistedQueries(): void {
  try {
    session()?.removeItem(CACHE_KEY);
  } catch {
    return;
  }
}

export function persistQueries(client: QueryClient): void {
  const store = session();
  if (!store) return;
  try {
    const raw = store.getItem(CACHE_KEY);
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (isSnapshot(saved) && Date.now() - saved.at < CACHE_AGE_MS) hydrate(client, saved.state);
  } catch {
    clearPersistedQueries();
  }
  const save = () => {
    try {
      const state = dehydrate(client, {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" && PERSISTED.has(String(query.queryKey[0])),
      });
      store.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), state }));
    } catch {
      clearPersistedQueries();
    }
  };
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}
