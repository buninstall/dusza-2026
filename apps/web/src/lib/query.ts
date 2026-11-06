import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api.ts";

const MAX_RETRIES = 2;
export const RECOVER_MS = 4000;
const SERVER_ERROR = 500;

export function isServerTrouble(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= SERVER_ERROR);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        refetchInterval: (query) => (isServerTrouble(query.state.error) ? RECOVER_MS : false),
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < MAX_RETRIES,
      },
    },
  });
}
