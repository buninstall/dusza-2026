import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { maps, mapVersions, runs } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";

const RECENT_RUNS = 100;

export function meRoutes(deps: Deps) {
  return new Hono<AppEnv>().use(requireUser(deps)).get("/runs", async (c) => {
    const list = await deps.db
      .select({
        id: runs.id,
        mapId: maps.id,
        mapTitle: maps.title,
        mapVersionId: runs.mapVersionId,
        version: mapVersions.version,
        gold: runs.gold,
        steps: runs.steps,
        outcomeKind: runs.outcomeKind,
        errorCode: runs.errorCode,
        errorLine: runs.errorLine,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .innerJoin(mapVersions, eq(mapVersions.id, runs.mapVersionId))
      .innerJoin(maps, eq(maps.id, mapVersions.mapId))
      .where(eq(runs.userId, c.var.user.id))
      .orderBy(desc(runs.createdAt), desc(runs.id))
      .limit(RECENT_RUNS);
    return c.json({ runs: list }, 200);
  });
}
