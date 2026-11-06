import { hashPassword } from "../auth/password.ts";
import { firstRow } from "../db/rows.ts";
import { type MapRow, maps, mapVersions, programs, runs, sessions, users } from "../db/schema.ts";
import type { Deps } from "../env.ts";
import { createMapWithVersion, currentVersion, validateMapContent } from "../services/maps.ts";
import { executeAndRecord } from "../services/runs.ts";
import { TUTORIAL_MAPS } from "./maps.ts";
import { SAMPLE_PROGRAMS } from "./programs.ts";
import { RECIPES } from "./recipes.ts";

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
  recipes: number;
  runs: number;
  skippedRuns: number;
};

async function wipe(deps: Deps): Promise<void> {
  await deps.db.transaction(async (tx) => {
    for (const table of [runs, programs, mapVersions, maps, sessions, users]) {
      await tx.delete(table);
    }
  });
}

async function createUsers(deps: Deps, now: number): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const [index, account] of DEMO_ACCOUNTS.entries()) {
    const created = firstRow(
      await deps.db
        .insert(users)
        .values({
          username: account.username,
          passwordHash: await hashPassword(account.password),
          role: account.role,
          createdAt: now + index,
        })
        .$returningId(),
    );
    ids.set(account.username, created.id);
  }
  return ids;
}

async function createMaps(deps: Deps, ownerId: number, now: number): Promise<MapRow[]> {
  const created: MapRow[] = [];
  for (const [index, tutorial] of TUTORIAL_MAPS.entries()) {
    const valid = validateMapContent(deps.engine, tutorial.content);
    if (!valid.ok) {
      throw new Error(`Hibás oktató térkép a seedben: ${tutorial.title}`);
    }
    created.push(
      await createMapWithVersion(deps.db, {
        ownerId,
        title: tutorial.title,
        description: tutorial.description,
        visibility: "public",
        valid,
        now: now + index,
      }),
    );
  }
  return created;
}

async function addRecipesToLibraries(
  deps: Deps,
  userIds: ReadonlyMap<string, number>,
  now: number,
): Promise<number> {
  const rows = [...userIds.values()].flatMap((ownerId) =>
    RECIPES.map((recipe, index) => ({
      ownerId,
      title: recipe.title,
      source: recipe.source,
      updatedAt: now - index - 1,
    })),
  );
  if (rows.length > 0) {
    await deps.db.insert(programs).values(rows);
  }
  return rows.length;
}

export async function seedDemo(deps: Deps, options: { reset: boolean }): Promise<SeedReport> {
  if (options.reset) {
    await wipe(deps);
  }
  const [existing] = await deps.db.select({ id: users.id }).from(users).limit(1);
  if (existing) {
    return {
      seeded: false,
      users: 0,
      maps: 0,
      programs: 0,
      recipes: 0,
      runs: 0,
      skippedRuns: 0,
    };
  }
  const now = deps.now();
  const userIds = await createUsers(deps, now);
  const adminId = userIds.get("admin") ?? 0;
  const createdMaps = await createMaps(deps, adminId, now);
  let recordedRuns = 0;
  let skippedRuns = 0;
  for (const [index, sample] of SAMPLE_PROGRAMS.entries()) {
    const ownerId = userIds.get(sample.owner);
    const map = createdMaps[sample.mapIndex];
    if (ownerId === undefined || !map) {
      throw new Error(`Hibás mintaprogram a seedben: ${sample.title}`);
    }
    await deps.db
      .insert(programs)
      .values({ ownerId, title: sample.title, source: sample.source, updatedAt: now + index });
    const version = await currentVersion(deps.db, map);
    if (!version) {
      continue;
    }
    const recorded = await executeAndRecord(deps.db, deps.engine, {
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
  const recipePrograms = await addRecipesToLibraries(deps, userIds, now);
  return {
    seeded: true,
    users: userIds.size,
    maps: createdMaps.length,
    programs: SAMPLE_PROGRAMS.length,
    recipes: recipePrograms,
    runs: recordedRuns,
    skippedRuns,
  };
}
