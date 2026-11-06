import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { maps } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { attachmentDisposition } from "../lib/request.ts";
import { validationHook } from "../lib/validation.ts";
import {
  canEdit,
  canView,
  createMapWithVersion,
  currentVersion,
  findMap,
  leaderboard,
  listMaps,
  mapBelongsToVersion,
  replaceContent,
  runCount,
  validateMapContent,
  versionList,
} from "../services/maps.ts";
import {
  createMapSchema,
  idParam,
  leaderboardQuery,
  listMapsQuery,
  updateMapSchema,
} from "./schemas.ts";

const invalidMapMessage = "A térkép nem felel meg a szabályoknak.";

export function mapRoutes(deps: Deps) {
  const detail = (mapId: number) => {
    const map = findMap(deps.db, mapId);
    const version = map ? currentVersion(deps.db, map) : undefined;
    if (!map || !version) {
      return null;
    }
    const parsed = deps.engine.parseMap(version.content);
    return {
      map,
      version,
      info: parsed.map ? deps.engine.mapInfo(parsed.map) : null,
      warnings: parsed.diagnostics,
      versions: versionList(deps.db, map.id),
      runCount: runCount(deps.db, version.id),
    };
  };

  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .get("/", zValidator("query", listMapsQuery, validationHook), (c) => {
      const { scope } = c.req.valid("query");
      return c.json({ maps: listMaps(deps.db, c.var.user, scope) }, 200);
    })
    .post("/", zValidator("json", createMapSchema, validationHook), (c) => {
      const input = c.req.valid("json");
      const valid = validateMapContent(deps.engine, input.content);
      if (!valid.ok) {
        return apiError(c, 422, "MAP_INVALID", invalidMapMessage, valid.diagnostics);
      }
      const created = createMapWithVersion(deps.db, {
        ownerId: c.var.user.id,
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        valid,
        now: deps.now(),
      });
      return c.json({ map: created, warnings: valid.warnings }, 201);
    })
    .get("/:id", zValidator("param", idParam, validationHook), (c) => {
      const found = detail(c.req.valid("param").id);
      if (!found || !canView(c.var.user, found.map)) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json({ ...found, canEdit: canEdit(c.var.user, found.map) }, 200);
    })
    .put(
      "/:id",
      zValidator("param", idParam, validationHook),
      zValidator("json", updateMapSchema, validationHook),
      (c) => {
        const map = findMap(deps.db, c.req.valid("param").id);
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
          createdNewVersion = replaceContent(deps.db, map, valid, now).createdNewVersion;
        }
        const updated = deps.db
          .update(maps)
          .set({
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
            updatedAt: now,
          })
          .where(eq(maps.id, map.id))
          .returning()
          .get();
        return c.json({ map: updated, createdNewVersion }, 200);
      },
    )
    .delete("/:id", zValidator("param", idParam, validationHook), (c) => {
      const map = findMap(deps.db, c.req.valid("param").id);
      if (!map || !canView(c.var.user, map)) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      if (!canEdit(c.var.user, map)) {
        return apiError(c, 403, "FORBIDDEN", messages.forbidden);
      }
      deps.db.delete(maps).where(eq(maps.id, map.id)).run();
      return c.json({ ok: true }, 200);
    })
    .get("/:id/export", zValidator("param", idParam, validationHook), (c) => {
      const found = detail(c.req.valid("param").id);
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
      (c) => {
        const found = detail(c.req.valid("param").id);
        if (!found || !canView(c.var.user, found.map)) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        const versionId = c.req.valid("query").version ?? found.version.id;
        if (!mapBelongsToVersion(deps.db, found.map.id, versionId)) {
          return apiError(c, 404, "NOT_FOUND", "Ehhez a térképhez nincs ilyen verzió.");
        }
        return c.json(
          {
            mapId: found.map.id,
            title: found.map.title,
            versionId,
            currentVersionId: found.version.id,
            versions: found.versions,
            entries: leaderboard(deps.db, versionId),
          },
          200,
        );
      },
    );
}
