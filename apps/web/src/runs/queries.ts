import { queryOptions } from "@tanstack/react-query";
import { api, call } from "../lib/api.ts";

const fetchMyRuns = () => call(api.me.runs.$get());

const fetchRun = (runId: number) => call(api.runs[":id"].$get({ param: { id: String(runId) } }));

export type RunRow = Awaited<ReturnType<typeof fetchMyRuns>>["runs"][number];
export type RunDetail = Awaited<ReturnType<typeof fetchRun>>;

export const myRunsQuery = queryOptions({ queryKey: ["my-runs"], queryFn: fetchMyRuns });

export const runDetailQuery = (runId: number) =>
  queryOptions({ queryKey: ["run", runId], queryFn: () => fetchRun(runId), staleTime: Infinity });
