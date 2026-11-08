import { zValidator } from "@hono/zod-validator";
import { count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { maps, mapVersions, runs } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";
import { offsetOf, pageMeta } from "../lib/paging.ts";
import { validationHook } from "../lib/validation.ts";
import { runsPageQuery } from "./schemas.ts";

export function meRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .get("/runs", zValidator("query", runsPageQuery, validationHook), async (c) => {
      const userId = c.var.user.id;
      const [counted] = await deps.db
        .select({ value: count() })
        .from(runs)
        .where(eq(runs.userId, userId));
      const meta = pageMeta(c.req.valid("query"), counted?.value ?? 0);
      const list =
        meta.total === 0
          ? []
          : await deps.db
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
              .where(eq(runs.userId, userId))
              .orderBy(desc(runs.createdAt), desc(runs.id))
              .limit(meta.pageSize)
              .offset(offsetOf(meta));
      return c.json({ ...meta, runs: list }, 200);
    });
}
