import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { type ProgramRow, programs } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { validationHook } from "../lib/validation.ts";
import { createProgram, listProgramPage, PROGRAM_LIMIT } from "../services/programs.ts";
import { idParam, programSchema, programsQuery, updateProgramSchema } from "./schemas.ts";

const limitMessage = `A programtárban legfeljebb ${PROGRAM_LIMIT} program fér el. Törölj egy régit, mielőtt újat mentesz.`;

export function programRoutes(deps: Deps) {
  const owned = async (id: number, ownerId: number): Promise<ProgramRow | undefined> => {
    const [program] = await deps.db
      .select()
      .from(programs)
      .where(and(eq(programs.id, id), eq(programs.ownerId, ownerId)))
      .limit(1);
    return program;
  };

  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .get("/", zValidator("query", programsQuery, validationHook), async (c) =>
      c.json(await listProgramPage(deps.db, c.var.user.id, c.req.valid("query")), 200),
    )
    .post("/", zValidator("json", programSchema, validationHook), async (c) => {
      const created = await createProgram(deps.db, {
        ...c.req.valid("json"),
        ownerId: c.var.user.id,
        now: deps.now(),
      });
      if (!created) {
        return apiError(c, 409, "PROGRAM_LIMIT", limitMessage);
      }
      return c.json({ program: created }, 201);
    })
    .get("/:id", zValidator("param", idParam, validationHook), async (c) => {
      const program = await owned(c.req.valid("param").id, c.var.user.id);
      if (!program) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json({ program }, 200);
    })
    .put(
      "/:id",
      zValidator("param", idParam, validationHook),
      zValidator("json", updateProgramSchema, validationHook),
      async (c) => {
        const program = await owned(c.req.valid("param").id, c.var.user.id);
        if (!program) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        const input = c.req.valid("json");
        await deps.db
          .update(programs)
          .set({
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.source === undefined ? {} : { source: input.source }),
            updatedAt: deps.now(),
          })
          .where(eq(programs.id, program.id));
        const updated = await owned(program.id, c.var.user.id);
        if (!updated) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        return c.json({ program: updated }, 200);
      },
    )
    .delete("/:id", zValidator("param", idParam, validationHook), async (c) => {
      const program = await owned(c.req.valid("param").id, c.var.user.id);
      if (!program) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      await deps.db.delete(programs).where(eq(programs.id, program.id));
      return c.json({ ok: true }, 200);
    });
}
