import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireAdmin, requireUser } from "../auth/middleware.ts";
import { users } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { validationHook } from "../lib/validation.ts";
import { createAccount } from "../services/accounts.ts";
import { idParam, newAccountSchema, roleSchema } from "./schemas.ts";

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
    .get("/users", async (c) => {
      const list = await deps.db.select(userColumns).from(users).orderBy(asc(users.id));
      return c.json({ users: list }, 200);
    })
    .post("/users", zValidator("json", newAccountSchema, validationHook), async (c) => {
      const created = await createAccount(deps, c.req.valid("json"));
      if (!created) {
        return apiError(c, 409, "USERNAME_TAKEN", "Ez a felhasználónév már foglalt.");
      }
      const { id, username, role, createdAt } = created;
      return c.json({ user: { id, username, role, createdAt } }, 201);
    })
    .patch(
      "/users/:id",
      zValidator("param", idParam, validationHook),
      zValidator("json", roleSchema, validationHook),
      async (c) => {
        const { id } = c.req.valid("param");
        if (id === c.var.user.id) {
          return apiError(c, 409, "SELF_CHANGE", "A saját szerepköröd nem módosíthatod.");
        }
        await deps.db
          .update(users)
          .set({ role: c.req.valid("json").role })
          .where(eq(users.id, id));
        const [updated] = await deps.db.select(userColumns).from(users).where(eq(users.id, id));
        if (!updated) {
          return apiError(c, 404, "NOT_FOUND", messages.notFound);
        }
        return c.json({ user: updated }, 200);
      },
    )
    .delete("/users/:id", zValidator("param", idParam, validationHook), async (c) => {
      const { id } = c.req.valid("param");
      if (id === c.var.user.id) {
        return apiError(c, 409, "SELF_CHANGE", "A saját fiókodat nem törölheted.");
      }
      const [result] = await deps.db.delete(users).where(eq(users.id, id));
      if (result.affectedRows === 0) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json({ ok: true }, 200);
    });
}
