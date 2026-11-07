import type { EngineCase, Trace } from "../engine.ts";
import type { TestCase } from "../parsers.ts";
import type { LiveCase, Settings } from "../runner.ts";
import type { Finding, Run, Target } from "../store.ts";
import type { DiscoveredTest, Suite } from "../suites.ts";
import type { Summary } from "../summary.ts";

export type SuiteView = Omit<Suite, "command" | "builtin">;
export type RunSummary = Omit<Run, "cases"> & { failedCases: number };
export type RunDetail = Run & { tail: string[] };
export type QueueState = { active: string | null; queued: string[] };
export type ConsoleState = {
  suites: SuiteView[];
  runs: RunSummary[];
  findings: Finding[];
  queue: QueueState;
  settings: Settings;
  dataDir: string;
  serverTime: number;
};
export type Comparison = {
  a: RunSummary;
  b: RunSummary;
  newlyFailing: TestCase[];
  fixed: TestCase[];
  stillFailing: TestCase[];
  added: TestCase[];
  removed: TestCase[];
};
export type { DiscoveredTest, Finding, LiveCase, Summary, Target, TestCase, Trace };
export type EngineCaseLite = Pick<EngineCase, "id" | "source" | "group" | "ref" | "name" | "kind">;

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      "X-CSRF-Token": csrf(),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (response.status === 401) {
    window.location.replace("/");
    throw new ApiError("A munkamenet lejárt.", 401);
  }
  const type = response.headers.get("content-type") ?? "";
  const data: unknown = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String(data.error)
        : `HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export const startRuns = (
  suiteId: string,
  extra: { target?: Target; repeat?: number; randomize?: boolean; deep?: boolean } = {},
) => api<{ runs: RunSummary[] }>("/api/runs", { method: "POST", body: { suiteId, ...extra } });

export const startMany = (body: { includeLong?: boolean; group?: string; suiteIds?: string[] }) =>
  api<{ runs: RunSummary[] }>("/api/runs/all", { method: "POST", body });
