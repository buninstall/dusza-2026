import { queryOptions } from "@tanstack/react-query";
import { ApiError, api, call } from "../lib/api.ts";

const SESSION_STALE_MS = 60_000;

export async function fetchSession() {
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
  staleTime: SESSION_STALE_MS,
});

export function safeRedirect(target: string | undefined): string {
  return target?.startsWith("/") && !target.startsWith("//") ? target : "/maps";
}
