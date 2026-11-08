import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, call } from "../lib/api.ts";

export const RUNS_PER_PAGE = 9;

const fetchMyRuns = (page: number) =>
  call(api.me.runs.$get({ query: { page: String(page), pageSize: String(RUNS_PER_PAGE) } }));

const fetchRun = (runId: number) => call(api.runs[":id"].$get({ param: { id: String(runId) } }));

export type RunPage = Awaited<ReturnType<typeof fetchMyRuns>>;
export type RunRow = RunPage["runs"][number];
export type RunDetail = Awaited<ReturnType<typeof fetchRun>>;

export const myRunsQuery = (page: number) =>
  queryOptions({
    queryKey: ["my-runs", page],
    queryFn: () => fetchMyRuns(page),
    placeholderData: keepPreviousData,
  });

export const runDetailQuery = (runId: number) =>
  queryOptions({ queryKey: ["run", runId], queryFn: () => fetchRun(runId), staleTime: Infinity });
