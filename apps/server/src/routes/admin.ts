import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireAdmin, requireUser } from "../auth/middleware.ts";
import { users } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { validationHook } from "../lib/validation.ts";
import { idParam, roleSchema } from "./schemas.ts";

export function adminRoutes(deps: Deps) {
  const userColumns = {
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
  };

  return new Hono<AppEnv>()
    .use(requireUser(deps))
    .use(requireAdmin)
    .get("/users", (c) => {
      const list = deps.db.select(userColumns).from(users).orderBy(asc(users.id)).all();
      return c.json({ users: list }, 200);
    })
    .patch(
      "/users/:id",
      zValidator("param", idParam, validationHook),
      zValidator("json", roleSchema, validationHook),
      (c) => {
        const { id } = c.req.valid("param");
        if (id === c.var.user.id) {
          return apiError(c, 409, "SELF_CHANGE", "A saját szerepköröd nem módosíthatod.");
        }
        const updated = deps.db
          .update(users)
          .set({ role: c.req.valid("json").role })
          .where(eq(users.id, id))
          .returning(userColumns)
          .get();
        if (!updated) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        return c.json({ user: updated }, 200);
      },
    )
    .delete("/users/:id", zValidator("param", idParam, validationHook), (c) => {
      const { id } = c.req.valid("param");
      if (id === c.var.user.id) {
        return apiError(c, 409, "SELF_CHANGE", "A saját fiókodat nem törölheted.");
      }
      const deleted = deps.db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id })
        .get();
      if (!deleted) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json({ ok: true }, 200);
    });
}
