import type { Event, MineMap, RobotState, RunResult } from "@minescript/engine";
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
    visibility: "public" as const,
    ownerId,
    ownerName: ownerId === 1 ? "admin" : "demo1",
    parSteps: null as number | null,
    createdAt: CREATED,
    updatedAt: CREATED,
    versionId: id * 10,
    version: 1,
    content,
    rows: parsed.rows,
    cols: parsed.cols,
    goldTotal: info.goldTotal,
    reachableGold: info.reachableGold,
    likes: 0,
    likedByMe: false,
    best: null as { gold: number; steps: number } | null,
    stars: (info.reachableGold > 0 ? 0 : null) as number | null,
  };
}

type DetailOptions = {
  canEdit?: boolean;
  runCount?: number;
  version?: number;
  parSteps?: number | null;
  hasPlayed?: boolean;
  isDaily?: boolean;
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
      dailyDate: options.isDaily ? "2026-11-06" : null,
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
    player: {
      best: null as { gold: number; steps: number } | null,
      stars: 0 as number | null,
      likes: 0,
      likedByMe: false,
      hasPlayed: options.hasPlayed ?? false,
      isDaily: options.isDaily ?? false,
    },
  };
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
