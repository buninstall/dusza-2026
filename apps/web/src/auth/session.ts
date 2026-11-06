import { queryOptions, useQuery } from "@tanstack/react-query";
import { ApiError, api, call } from "../lib/api.ts";

async function fetchSession() {
  try {
    const { user } = await call(api.auth.me.$get());
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof fetchSession>>>;

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: fetchSession,
  staleTime: 60_000,
});

export function useSession() {
  return useQuery(sessionQuery);
}
