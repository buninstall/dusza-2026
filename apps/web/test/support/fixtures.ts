import type { Event, MineMap, RobotState, RunResult } from "@minescript/engine";
import { onApi, respond } from "./api.ts";
import { realEngine } from "./engine.ts";

const CREATED = 1_793_960_000_000;

export const demoUser = { id: 2, username: "demo1", role: "user" as const, createdAt: CREATED };
export const adminUser = { id: 1, username: "admin", role: "admin" as const, createdAt: CREATED };

export const CORRIDOR = "1 8\n>..@..@.\n";
export const LABYRINTH = "4 5\nv#.@#\n.#..#\n...@.\n#####\n";

export function mapSummary(id: number, title: string, content: string, ownerId = 1) {
  const parsed = realEngine.parseMap(content).map;
  if (!parsed) {
    throw new Error(`Invalid fixture map: ${title}`);
  }
  const info = realEngine.mapInfo(parsed);
  return {
    id,
    title,
    description: `${title} leírása`,
    visibility: "public" as "public" | "private",
    ownerId,
    ownerName: ownerId === 1 ? "admin" : "demo1",
    isStory: false,
    parSteps: null as number | null,
    lampMode: "open" as "open" | "lamp" | "dark",
    favoriteCount: 0,
    isFavorite: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    versionId: id * 10,
    version: 1,
    content,
    rows: parsed.rows,
    cols: parsed.cols,
    goldTotal: info.goldTotal,
    reachableGold: info.reachableGold,
    difficulty: "easy" as "easy" | "medium" | "hard" | null,
    best: null as { gold: number; steps: number } | null,
    stars: (info.reachableGold > 0 ? 0 : null) as number | null,
  };
}

type DetailOptions = {
  canEdit?: boolean;
  runCount?: number;
  version?: number;
  parSteps?: number | null;
  isDaily?: boolean;
  lampMode?: "open" | "lamp" | "dark";
  stars?: number | null;
  next?: { id: number; title: string } | null;
};

export function mapDetail(id: number, title: string, content: string, options: DetailOptions = {}) {
  const parsed = realEngine.parseMap(content);
  const version = options.version ?? 1;
  return {
    map: {
      id,
      ownerId: 1,
      title,
      description: `${title} leírása`,
      visibility: "public" as const,
      currentVersionId: id * 10 + version,
      parSteps: options.parSteps ?? null,
      lampMode: options.lampMode ?? "open",
      dailyDate: options.isDaily ? "2026-11-06" : null,
      favoriteCount: 0,
      createdAt: CREATED,
      updatedAt: CREATED,
    },
    version: {
      id: id * 10 + version,
      mapId: id,
      version,
      content,
      contentHash: "hash",
      rows: parsed.map?.rows ?? 1,
      cols: parsed.map?.cols ?? 1,
      goldTotal: 2,
      reachableGold: 2,
      difficulty: "easy" as "easy" | "medium" | "hard" | "none" | null,
      createdAt: CREATED,
    },
    info: parsed.map ? realEngine.mapInfo(parsed.map) : null,
    warnings: parsed.diagnostics,
    versions: Array.from({ length: version }, (_, index) => ({
      id: id * 10 + index + 1,
      version: index + 1,
      createdAt: CREATED,
    })),
    runCount: options.runCount ?? 0,
    canEdit: options.canEdit ?? true,
    isFavorite: false,
    next: (options.next ?? null) as { id: number; title: string } | null,
    player: {
      best: null as { gold: number; steps: number } | null,
      stars: (options.stars === undefined ? 0 : options.stars) as number | null,
      isDaily: options.isDaily ?? false,
      difficulty: "easy" as "easy" | "medium" | "hard" | null,
    },
  };
}

type Summary = ReturnType<typeof mapSummary>;

const DEFAULT_PAGE_SIZE = 24;

export function pageOf<T>(items: readonly T[], search?: URLSearchParams) {
  const pageSize = Number(search?.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(search?.get("page") ?? 1)), pageCount);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total,
    pageCount,
  };
}

export function mapPage(maps: readonly Summary[], search?: URLSearchParams) {
  const { items, ...meta } = pageOf(maps, search);
  return { ...meta, maps: items };
}

export function respondMaps(maps: readonly Summary[], userId = demoUser.id): void {
  const sandbox = maps.filter((map) => !map.isStory);
  onApi("GET", "/maps", (request) => {
    const scope = request.search.get("scope");
    const q = (request.search.get("q") ?? "").toLowerCase();
    const shown = sandbox.filter(
      (map) =>
        (scope !== "mine" || map.ownerId === userId) &&
        (scope !== "favorites" || map.isFavorite) &&
        (q.length === 0 || map.title.toLowerCase().includes(q)),
    );
    return { body: mapPage(shown, request.search) };
  });
  respond("GET", "/maps/story", { maps: maps.filter((map) => map.isStory) });
  respond("GET", "/maps/stats", {
    maps: sandbox.length,
    authors: new Set(sandbox.map((map) => map.ownerId)).size,
  });
}

export function runPage<T>(runs: readonly T[], search?: URLSearchParams) {
  const { items, ...meta } = pageOf(runs, search);
  return { ...meta, runs: items };
}

export function respondRuns<T>(runs: readonly T[]): void {
  onApi("GET", "/me/runs", (request) => ({ body: runPage(runs, request.search) }));
}

type ProgramItem = { id: number; title: string; updatedAt: number; lines?: number };

export function respondPrograms(programs: readonly ProgramItem[]): void {
  onApi("GET", "/programs", (request) => {
    const { items, ...meta } = pageOf(
      programs.map((program) => ({ lines: 1, ...program })),
      request.search,
    );
    return { body: { ...meta, programs: items, quota: { used: programs.length, limit: 500 } } };
  });
}

type UserItem = { id: number; username: string; role: string; createdAt: number };

export function respondUsers(accounts: readonly UserItem[]): void {
  onApi("GET", "/admin/users", (request) => {
    const q = (request.search.get("q") ?? "").toLowerCase();
    const shown = accounts.filter((account) => account.username.toLowerCase().includes(q));
    const { items, ...meta } = pageOf(shown, request.search);
    const admins = accounts.filter((account) => account.role === "admin").length;
    return { body: { ...meta, users: items, admins } };
  });
}

export const corridorMap: MineMap = {
  rows: 1,
  cols: 4,
  cells: [["empty", "empty", "gold", "wall"]],
  robot: { row: 0, col: 0 },
  dir: "east",
};

export const corridorStart: RobotState = { pos: { row: 0, col: 0 }, dir: "east" };

type EventInput = Partial<Event> & Pick<Event, "line">;

export function trace(inputs: readonly EventInput[], outcome: RunResult["outcome"]): RunResult {
  let robot = corridorStart;
  let gold = 0;
  const events = inputs.map((input, index): Event => {
    robot = input.robot ?? robot;
    gold = input.gold ?? gold;
    return {
      index,
      steps: index + 1,
      path: [],
      discovered: [],
      mined: null,
      print: null,
      assigned: null,
      ...input,
      robot,
      gold,
    };
  });
  return {
    outcome,
    events,
    gold,
    steps: events.length,
    console: events.flatMap((event) => (event.print === null ? [] : [event.print])),
    finalRobot: robot,
    discovered: [corridorStart.pos],
  };
}

export const walkTrace = trace(
  [
    {
      line: 1,
      discovered: [{ row: 0, col: 1 }],
      assigned: { name: "elol", value: { kind: "bool", value: false } },
    },
    {
      line: 2,
      robot: { pos: { row: 0, col: 2 }, dir: "east" },
      path: [
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      discovered: [{ row: 0, col: 2 }],
    },
    { line: 3, mined: { row: 0, col: 2 }, gold: 1 },
    { line: 4, print: "1" },
    { line: 5, robot: { pos: { row: 0, col: 2 }, dir: "north" } },
  ],
  { kind: "ok" },
);

export const crashTrace = trace(
  [
    { line: 1, robot: { pos: { row: 0, col: 2 }, dir: "east" }, path: [{ row: 0, col: 1 }] },
    { line: 2 },
  ],
  { kind: "runtimeError", code: "E_BEDROCK_HIT", line: 2, message: "Falba ütközés" },
);
