import { useRef, useSyncExternalStore } from "react";
import { create } from "zustand";
import {
  api,
  type ConsoleState,
  type Finding,
  type LiveCase,
  type QueueState,
  type RunSummary,
  type SuiteView,
} from "./api.ts";

type LiveState = {
  ready: boolean;
  connected: boolean;
  suites: SuiteView[];
  runs: Map<string, RunSummary>;
  findings: Finding[];
  queue: QueueState;
  settings: ConsoleState["settings"];
  dataDir: string;
  clockSkew: number;
  logListeners: Set<(runId: string, lines: string[]) => void>;
  live: Map<string, Map<number, LiveCase>>;
  mergeLive: (runId: string, cases: LiveCase[], replace?: boolean) => void;
  load: () => Promise<void>;
  upsertRun: (run: RunSummary) => void;
  setFindings: (findings: Finding[]) => void;
};

export const useLive = create<LiveState>((set, get) => ({
  ready: false,
  connected: false,
  suites: [],
  runs: new Map(),
  findings: [],
  queue: { active: null, queued: [] },
  settings: { baseUrl: "", timeoutMinutes: 60 },
  dataDir: "",
  clockSkew: 0,
  logListeners: new Set(),
  live: new Map(),
  mergeLive: (runId, cases, replace = false) => {
    const live = new Map(get().live);
    const current = new Map(replace ? [] : (live.get(runId) ?? []));
    for (const item of cases) current.set(item.seq, item);
    live.set(runId, current);
    if (live.size > 20) live.delete(live.keys().next().value ?? "");
    set({ live });
  },
  load: async () => {
    const state = await api<ConsoleState>("/api/state");
    set({
      ready: true,
      suites: state.suites,
      runs: new Map(state.runs.map((run) => [run.id, run])),
      findings: state.findings,
      queue: state.queue,
      settings: state.settings,
      dataDir: state.dataDir,
      clockSkew: Date.now() - state.serverTime,
    });
  },
  upsertRun: (run) => {
    const runs = new Map(get().runs);
    runs.set(run.id, run);
    set({ runs });
  },
  setFindings: (findings) => set({ findings }),
}));

type Notify = (run: RunSummary) => void;
let onFinished: Notify | null = null;
export const setFinishedHandler = (handler: Notify) => {
  onFinished = handler;
};

export function connectEvents(): () => void {
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let refresh: ReturnType<typeof setTimeout> | null = null;
  const open = () => {
    source = new EventSource("/api/events");
    source.addEventListener("hello", () => useLive.setState({ connected: true }));
    source.addEventListener("run", (event) => {
      const run = JSON.parse((event as MessageEvent<string>).data) as RunSummary;
      const previous = useLive.getState().runs.get(run.id);
      useLive.getState().upsertRun(run);
      const finished = !["queued", "running"].includes(run.status);
      if (finished && previous && ["queued", "running"].includes(previous.status)) {
        onFinished?.(run);
        if (refresh) clearTimeout(refresh);
        refresh = setTimeout(() => void useLive.getState().load(), 400);
      }
    });
    source.addEventListener("queue", (event) => {
      useLive.setState({ queue: JSON.parse((event as MessageEvent<string>).data) as QueueState });
    });
    source.addEventListener("cases", (event) => {
      const { runId, cases, complete } = JSON.parse((event as MessageEvent<string>).data) as {
        runId: string;
        cases: LiveCase[];
        complete?: boolean;
      };
      useLive.getState().mergeLive(runId, cases, complete === true);
    });
    source.addEventListener("log", (event) => {
      const { runId, lines } = JSON.parse((event as MessageEvent<string>).data) as {
        runId: string;
        lines: string[];
      };
      for (const listener of useLive.getState().logListeners) listener(runId, lines);
    });
    source.onerror = () => {
      useLive.setState({ connected: false });
      source?.close();
      retry = setTimeout(async () => {
        try {
          await useLive.getState().load();
        } finally {
          open();
        }
      }, 2500);
    };
  };
  open();
  return () => {
    source?.close();
    if (retry) clearTimeout(retry);
  };
}

export function useNow(intervalMs = 1000): number {
  return useSyncExternalStore(
    (notify) => {
      const timer = setInterval(notify, intervalMs);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
  );
}

export type Route =
  | { page: "overview" }
  | { page: "summary" }
  | { page: "engine"; run?: string; testCase?: string }
  | { page: "suites"; suite?: string }
  | { page: "runs"; run?: string }
  | { page: "findings"; finding?: string }
  | { page: "compare"; a?: string; b?: string }
  | { page: "settings" };

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [page, id] = path.split("/");
  const params = new URLSearchParams(query);
  if (page === "suites") return id ? { page, suite: id } : { page };
  if (page === "runs") return id ? { page, run: id } : { page };
  if (page === "findings") return id ? { page, finding: id } : { page };
  if (page === "compare") {
    const a = params.get("a");
    const b = params.get("b");
    return { page, ...(a ? { a } : {}), ...(b ? { b } : {}) };
  }
  if (page === "settings") return { page };
  if (page === "summary") return { page };
  if (page === "engine") {
    const run = params.get("run");
    const testCase = params.get("case");
    return { page, ...(run ? { run } : {}), ...(testCase ? { testCase } : {}) };
  }
  return { page: "overview" };
}

export function href(route: Route): string {
  switch (route.page) {
    case "overview":
      return "#/";
    case "suites":
      return route.suite ? `#/suites/${route.suite}` : "#/suites";
    case "runs":
      return route.run ? `#/runs/${route.run}` : "#/runs";
    case "findings":
      return route.finding ? `#/findings/${route.finding}` : "#/findings";
    case "compare":
      return `#/compare?${new URLSearchParams({ ...(route.a ? { a: route.a } : {}), ...(route.b ? { b: route.b } : {}) })}`;
    case "settings":
      return "#/settings";
    case "summary":
      return "#/summary";
    case "engine": {
      const query = new URLSearchParams({
        ...(route.run ? { run: route.run } : {}),
        ...(route.testCase ? { case: route.testCase } : {}),
      }).toString();
      return query ? `#/engine?${query}` : "#/engine";
    }
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

export const PAGE_ORDER: Route["page"][] = [
  "overview",
  "summary",
  "suites",
  "runs",
  "engine",
  "findings",
  "compare",
  "settings",
];

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (notify) => {
      window.addEventListener("hashchange", notify);
      return () => window.removeEventListener("hashchange", notify);
    },
    () => window.location.hash,
  );
  return parseRoute(hash);
}

export function useDescent(page: Route["page"]): "down" | "up" | "none" {
  const previous = useRef<Route["page"] | null>(null);
  const direction = useRef<"down" | "up" | "none">("none");
  if (previous.current !== page) {
    direction.current =
      previous.current === null
        ? "none"
        : PAGE_ORDER.indexOf(page) >= PAGE_ORDER.indexOf(previous.current)
          ? "down"
          : "up";
    previous.current = page;
  }
  return direction.current;
}

export const OPEN_STATUSES = new Set(["új", "megerősítve", "jelentve"]);
export const SEVERITIES = ["blokkoló", "magas", "közepes", "alacsony"] as const;
export const FINDING_STATUSES = [
  "új",
  "megerősítve",
  "jelentve",
  "javítva",
  "megszűnt",
  "hamis riasztás",
] as const;
export const OWNERS = ["futozs", "gergogyulai", "hgagadev", "csapat"] as const;

export function runsOf(
  runs: Map<string, RunSummary>,
  suiteId: string,
  fullOnly = true,
): RunSummary[] {
  return [...runs.values()]
    .filter((run) => run.suiteId === suiteId && (!fullOnly || !run.target))
    .sort((a, b) => a.queuedAt - b.queuedAt);
}

export function expectedDuration(runs: Map<string, RunSummary>, suiteId: string): number | null {
  const done = runsOf(runs, suiteId)
    .filter((run) => run.startedAt && run.finishedAt && ["passed", "failed"].includes(run.status))
    .slice(-5)
    .map((run) => (run.finishedAt ?? 0) - (run.startedAt ?? 0));
  if (done.length === 0) return null;
  const sorted = [...done].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "–";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} mp`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes} p ${seconds % 60} mp`
    : `${Math.floor(minutes / 60)} ó ${minutes % 60} p`;
}

export function formatTime(value: number | null | undefined): string {
  if (!value) return "–";
  return new Date(value).toLocaleString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function relative(value: number | null | undefined, now: number): string {
  if (!value) return "még soha";
  const seconds = Math.round((now - value) / 1000);
  if (seconds < 45) return "az imént";
  if (seconds < 3600) return `${Math.round(seconds / 60)} perce`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} órája`;
  return `${Math.round(seconds / 86_400)} napja`;
}
