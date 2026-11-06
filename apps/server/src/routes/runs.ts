import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { validationHook } from "../lib/validation.ts";
import { canView, findMap, findVersion, leaderboard } from "../services/maps.ts";
import { bestScore } from "../services/progress.ts";
import { executeAndRecord, findRunDetail } from "../services/runs.ts";
import { starsFor } from "../services/stars.ts";
import { idParam, runSchema } from "./schemas.ts";

export function runRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .get("/:id", zValidator("param", idParam, validationHook), async (c) => {
      const detail = await findRunDetail(deps.db, c.var.user, c.req.valid("param").id);
      if (!detail) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json(detail, 200);
    })
    .post("/", zValidator("json", runSchema, validationHook), async (c) => {
      const { mapVersionId, source } = c.req.valid("json");
      const version = await findVersion(deps.db, mapVersionId);
      const map = version ? await findMap(deps.db, version.mapId) : undefined;
      if (!version || !map || !canView(c.var.user, map)) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      const recorded = await executeAndRecord(deps.db, deps.engine, {
        userId: c.var.user.id,
        version,
        source,
        now: deps.now(),
      });
      if (recorded.kind === "missing") {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      if (recorded.kind === "syntaxError") {
        const diagnostics =
          recorded.result.outcome.kind === "syntaxError" ? recorded.result.outcome.diagnostics : [];
        return apiError(
          c,
          422,
          "SYNTAX_ERROR",
          "A program szintaktikailag hibás, ezért nem futtatható.",
          diagnostics,
        );
      }
      const { run, result } = recorded;
      const entries = await leaderboard(deps.db, run.mapVersionId);
      const own = entries.find((entry) => entry.userId === run.userId);
      const isPersonalBest = own?.runId === run.id;
      const previous = await bestScore(deps.db, run.userId, run.mapVersionId, run.id);
      const starsOf = (score: { gold: number; steps: number } | null) =>
        starsFor(score, version.reachableGold, map.parSteps);
      const runStars = starsOf(run);
      const standing = {
        rank: own?.rank ?? null,
        players: entries.length,
        isPersonalBest,
        stars:
          runStars === null
            ? null
            : {
                run: runStars,
                best: starsOf(own ?? null) ?? 0,
                previous: starsOf(previous) ?? 0,
                parSteps: map.parSteps,
              },
      };
      return c.json(
        {
          run: {
            id: run.id,
            mapVersionId: run.mapVersionId,
            gold: run.gold,
            steps: run.steps,
            outcomeKind: run.outcomeKind,
            errorCode: run.errorCode,
            errorLine: run.errorLine,
            createdAt: run.createdAt,
          },
          outcome: result.outcome,
          console: result.console,
          standing,
        },
        201,
      );
    });
}
