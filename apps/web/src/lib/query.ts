import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api.ts";

const MAX_RETRIES = 2;
export const RECOVER_MS = 4000;
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
        staleTime: 15_000,
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
