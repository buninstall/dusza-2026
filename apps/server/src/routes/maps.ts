import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { type MapRow, type MapVersionRow, maps } from "../db/schema.ts";
import type { AppEnv, Deps, SessionUser } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { attachmentDisposition } from "../lib/request.ts";
import { validationHook } from "../lib/validation.ts";
import { ensureDailyMap } from "../services/daily.ts";
import { computeParSteps, difficultyOf, generateMap } from "../services/generator.ts";
import {
  canEdit,
  canView,
  createMapWithVersion,
  currentVersion,
  findMap,
  leaderboard,
  listMaps,
  mapBelongsToVersion,
  mapSummaries,
  replaceContent,
  runCount,
  validateMapContent,
  versionList,
} from "../services/maps.ts";
import { bestScore, progressOf } from "../services/progress.ts";
import {
  createMapSchema,
  generateMapSchema,
  idParam,
  leaderboardQuery,
  listMapsQuery,
  parSchema,
  updateMapSchema,
} from "./schemas.ts";

const invalidMapMessage = "A térkép nem felel meg a szabályoknak.";

const MAX_SEED = 0xffff_ffff;

export function mapRoutes(deps: Deps) {
  const playerView = async (user: SessionUser, map: MapRow, version: MapVersionRow) => {
    const best = await bestScore(deps.db, user.id, version.id);
    return {
      ...progressOf(best, version.reachableGold, map.parSteps),
      isDaily: map.dailyDate !== null,
      difficulty: difficultyOf(deps.engine, version.content, version.contentHash),
    };
  };

  const detail = async (mapId: number) => {
    const map = await findMap(deps.db, mapId);
    const version = map ? await currentVersion(deps.db, map) : undefined;
    if (!map || !version) {
      return null;
    }
    const parsed = deps.engine.parseMap(version.content);
    return {
      map,
      version,
      info: parsed.map ? deps.engine.mapInfo(parsed.map) : null,
      warnings: parsed.diagnostics,
      versions: await versionList(deps.db, map.id),
      runCount: await runCount(deps.db, version.id),
    };
  };

  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .get("/", zValidator("query", listMapsQuery, validationHook), async (c) => {
      const { scope } = c.req.valid("query");
      return c.json({ maps: await listMaps(deps.db, deps.engine, c.var.user, scope) }, 200);
    })
    .get("/daily", async (c) => {
      const daily = await ensureDailyMap(deps, c.var.user);
      const [summary] = await mapSummaries(deps.db, deps.engine, c.var.user, eq(maps.id, daily.id));
      if (!summary) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json({ map: summary, date: daily.dailyDate ?? "" }, 200);
    })
    .post("/generate", zValidator("json", generateMapSchema, validationHook), (c) => {
      const input = c.req.valid("json");
      const seed = input.seed ?? Math.floor(Math.random() * MAX_SEED);
      return c.json({ ...generateMap(deps.engine, { ...input, seed }), seed }, 200);
    })
    .post("/par", zValidator("json", parSchema, validationHook), (c) => {
      const valid = validateMapContent(deps.engine, c.req.valid("json").content);
      if (!valid.ok) {
        return apiError(c, 422, "MAP_INVALID", invalidMapMessage, valid.diagnostics);
      }
      return c.json({ parSteps: computeParSteps(deps.engine, valid.canonical) }, 200);
    })
    .post("/", zValidator("json", createMapSchema, validationHook), async (c) => {
      const input = c.req.valid("json");
      const valid = validateMapContent(deps.engine, input.content);
      if (!valid.ok) {
        return apiError(c, 422, "MAP_INVALID", invalidMapMessage, valid.diagnostics);
      }
      const created = await createMapWithVersion(deps.db, {
        ownerId: c.var.user.id,
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        parSteps: input.parSteps,
        valid,
        now: deps.now(),
      });
      return c.json({ map: created, warnings: valid.warnings }, 201);
    })
    .get("/:id", zValidator("param", idParam, validationHook), async (c) => {
      const found = await detail(c.req.valid("param").id);
      if (!found || !canView(c.var.user, found.map)) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json(
        {
          ...found,
          canEdit: canEdit(c.var.user, found.map),
          player: await playerView(c.var.user, found.map, found.version),
        },
        200,
      );
    })
    .put(
      "/:id",
      zValidator("param", idParam, validationHook),
      zValidator("json", updateMapSchema, validationHook),
      async (c) => {
        const map = await findMap(deps.db, c.req.valid("param").id);
        if (!map || !canView(c.var.user, map)) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        if (!canEdit(c.var.user, map)) {
          return apiError(c, 403, "FORBIDDEN", messages.forbidden);
        }
        const input = c.req.valid("json");
        const now = deps.now();
        let createdNewVersion = false;
        if (input.content !== undefined) {
          const valid = validateMapContent(deps.engine, input.content);
          if (!valid.ok) {
            return apiError(c, 422, "MAP_INVALID", invalidMapMessage, valid.diagnostics);
          }
          const replaced = await replaceContent(deps.db, map, valid, now);
          createdNewVersion = replaced.createdNewVersion;
        }
        await deps.db
          .update(maps)
          .set({
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
            ...(input.parSteps === undefined ? {} : { parSteps: input.parSteps }),
            updatedAt: now,
          })
          .where(eq(maps.id, map.id));
        const updated = await findMap(deps.db, map.id);
        if (!updated) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        return c.json({ map: updated, createdNewVersion }, 200);
      },
    )
    .delete("/:id", zValidator("param", idParam, validationHook), async (c) => {
      const map = await findMap(deps.db, c.req.valid("param").id);
      if (!map || !canView(c.var.user, map)) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      if (!canEdit(c.var.user, map)) {
        return apiError(c, 403, "FORBIDDEN", messages.forbidden);
      }
      await deps.db.delete(maps).where(eq(maps.id, map.id));
      return c.json({ ok: true }, 200);
    })
    .get("/:id/export", zValidator("param", idParam, validationHook), async (c) => {
      const found = await detail(c.req.valid("param").id);
      if (!found || !canView(c.var.user, found.map)) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      c.header("Content-Type", "text/plain; charset=utf-8");
      c.header("Content-Disposition", attachmentDisposition(found.map.title, "txt"));
      return c.body(found.version.content, 200);
    })
    .get(
      "/:id/leaderboard",
      zValidator("param", idParam, validationHook),
      zValidator("query", leaderboardQuery, validationHook),
      async (c) => {
        const found = await detail(c.req.valid("param").id);
        if (!found || !canView(c.var.user, found.map)) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        const versionId = c.req.valid("query").version ?? found.version.id;
        if (!(await mapBelongsToVersion(deps.db, found.map.id, versionId))) {
          return apiError(c, 404, "NOT_FOUND", "Ehhez a térképhez nincs ilyen verzió.");
        }
        return c.json(
          {
            mapId: found.map.id,
            title: found.map.title,
            versionId,
            currentVersionId: found.version.id,
            versions: found.versions,
            entries: await leaderboard(deps.db, versionId),
          },
          200,
        );
      },
    );
}
