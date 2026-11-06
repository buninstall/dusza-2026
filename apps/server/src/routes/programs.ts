import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { programs } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { validationHook } from "../lib/validation.ts";
import { idParam, programSchema, updateProgramSchema } from "./schemas.ts";

export function programRoutes(deps: Deps) {
  const owned = (id: number, ownerId: number) =>
    deps.db
      .select()
      .from(programs)
      .where(and(eq(programs.id, id), eq(programs.ownerId, ownerId)))
      .get();

  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .get("/", (c) => {
      const list = deps.db
        .select({ id: programs.id, title: programs.title, updatedAt: programs.updatedAt })
        .from(programs)
        .where(eq(programs.ownerId, c.var.user.id))
        .orderBy(desc(programs.updatedAt))
        .all();
      return c.json({ programs: list }, 200);
    })
    .post("/", zValidator("json", programSchema, validationHook), (c) => {
      const input = c.req.valid("json");
      const created = deps.db
        .insert(programs)
        .values({ ...input, ownerId: c.var.user.id, updatedAt: deps.now() })
        .returning()
        .get();
      return c.json({ program: created }, 201);
    })
    .get("/:id", zValidator("param", idParam, validationHook), (c) => {
      const program = owned(c.req.valid("param").id, c.var.user.id);
      if (!program) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json({ program }, 200);
    })
    .put(
      "/:id",
      zValidator("param", idParam, validationHook),
      zValidator("json", updateProgramSchema, validationHook),
      (c) => {
        const program = owned(c.req.valid("param").id, c.var.user.id);
        if (!program) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        const input = c.req.valid("json");
        const updated = deps.db
          .update(programs)
          .set({
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.source === undefined ? {} : { source: input.source }),
            updatedAt: deps.now(),
          })
          .where(eq(programs.id, program.id))
          .returning()
          .get();
        return c.json({ program: updated }, 200);
      },
    )
    .delete("/:id", zValidator("param", idParam, validationHook), (c) => {
      const program = owned(c.req.valid("param").id, c.var.user.id);
      if (!program) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      deps.db.delete(programs).where(eq(programs.id, program.id)).run();
      return c.json({ ok: true }, 200);
    });
}
