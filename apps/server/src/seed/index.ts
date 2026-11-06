import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password.ts";
import { type MapRow, maps, mapVersions, programs, runs, sessions, users } from "../db/schema.ts";
import type { Deps } from "../env.ts";
import { createMapWithVersion, currentVersion, validateMapContent } from "../services/maps.ts";
import { executeAndRecord } from "../services/runs.ts";
import { TUTORIAL_MAPS } from "./maps.ts";
import { SAMPLE_PROGRAMS } from "./programs.ts";

export const DEMO_ACCOUNTS = [
  { username: "admin", password: "dusza2026", role: "admin" },
  { username: "demo1", password: "demo2026", role: "user" },
  { username: "demo2", password: "demo2026", role: "user" },
  { username: "demo3", password: "demo2026", role: "user" },
] as const;

export type SeedReport = {
  seeded: boolean;
  users: number;
  maps: number;
  programs: number;
  runs: number;
  skippedRuns: number;
};

function wipe(deps: Deps): void {
  deps.db.transaction((tx) => {
    tx.delete(runs).run();
    tx.delete(programs).run();
    tx.delete(mapVersions).run();
    tx.delete(maps).run();
    tx.delete(sessions).run();
    tx.delete(users).run();
  });
}

async function createUsers(deps: Deps, now: number): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const [index, account] of DEMO_ACCOUNTS.entries()) {
    const created = deps.db
      .insert(users)
      .values({
        username: account.username,
        passwordHash: await hashPassword(account.password),
        role: account.role,
        createdAt: now + index,
      })
      .returning({ id: users.id })
      .get();
    ids.set(account.username, created.id);
  }
  return ids;
}

function createMaps(deps: Deps, ownerId: number, now: number): MapRow[] {
  return TUTORIAL_MAPS.map((tutorial, index) => {
    const valid = validateMapContent(deps.engine, tutorial.content);
    if (!valid.ok) {
      throw new Error(`Hibás oktató térkép a seedben: ${tutorial.title}`);
    }
    return createMapWithVersion(deps.db, {
      ownerId,
      title: tutorial.title,
      description: tutorial.description,
      visibility: "public",
      valid,
      now: now + index,
    });
  });
}

export async function seedDemo(deps: Deps, options: { reset: boolean }): Promise<SeedReport> {
  if (options.reset) {
    wipe(deps);
  }
  const existing = deps.db.select({ id: users.id }).from(users).limit(1).get();
  if (existing) {
    return { seeded: false, users: 0, maps: 0, programs: 0, runs: 0, skippedRuns: 0 };
  }
  const now = deps.now();
  const userIds = await createUsers(deps, now);
  const adminId = userIds.get("admin") ?? 0;
  const createdMaps = createMaps(deps, adminId, now);
  let recordedRuns = 0;
  let skippedRuns = 0;
  for (const [index, sample] of SAMPLE_PROGRAMS.entries()) {
    const ownerId = userIds.get(sample.owner);
    const map = createdMaps[sample.mapIndex];
    if (ownerId === undefined || !map) {
      throw new Error(`Hibás mintaprogram a seedben: ${sample.title}`);
    }
    deps.db
      .insert(programs)
      .values({ ownerId, title: sample.title, source: sample.source, updatedAt: now + index })
      .run();
    const freshMap = deps.db.select().from(maps).where(eq(maps.id, map.id)).get();
    const version = freshMap ? currentVersion(deps.db, freshMap) : undefined;
    if (!version) {
      continue;
    }
    const recorded = executeAndRecord(deps.db, deps.engine, {
      userId: ownerId,
      version,
      source: sample.source,
      now: now + index,
    });
    if (recorded.kind === "recorded") {
      recordedRuns += 1;
    } else {
      skippedRuns += 1;
    }
  }
  return {
    seeded: true,
    users: userIds.size,
    maps: createdMaps.length,
    programs: SAMPLE_PROGRAMS.length,
    runs: recordedRuns,
    skippedRuns,
  };
}
