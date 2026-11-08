import { zValidator } from "@hono/zod-validator";
import { asc, count, eq, like } from "drizzle-orm";
import { Hono } from "hono";
import { requireAdmin, requireUser } from "../auth/middleware.ts";
import { users } from "../db/schema.ts";
import type { AppEnv, Deps } from "../env.ts";
import { apiError, messages } from "../lib/errors.ts";
import { containsPattern, offsetOf, pageMeta } from "../lib/paging.ts";
import { validationHook } from "../lib/validation.ts";
import { createAccount } from "../services/accounts.ts";
import { ownsStoryMaps } from "../services/map-list.ts";
import { adminUsersQuery, idParam, newAccountSchema, roleSchema } from "./schemas.ts";

const STORY_OWNER_MESSAGE =
  "Ez a fiók a Történet mód pályáinak gazdája, ezért nem törölhető és nem fokozható le: a kampány vele együtt eltűnne.";

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
    .get("/users", zValidator("query", adminUsersQuery, validationHook), async (c) => {
      const query = c.req.valid("query");
      const filter =
        query.q.length > 0 ? like(users.username, containsPattern(query.q)) : undefined;
      const [[counted], [admins]] = await Promise.all([
        deps.db.select({ value: count() }).from(users).where(filter),
        deps.db.select({ value: count() }).from(users).where(eq(users.role, "admin")),
      ]);
      const meta = pageMeta(query, counted?.value ?? 0);
      const list =
        meta.total === 0
          ? []
          : await deps.db
              .select(userColumns)
              .from(users)
              .where(filter)
              .orderBy(asc(users.id))
              .limit(meta.pageSize)
              .offset(offsetOf(meta));
      return c.json({ ...meta, users: list, admins: admins?.value ?? 0 }, 200);
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
        if (c.req.valid("json").role !== "admin" && (await ownsStoryMaps(deps.db, id))) {
          return apiError(c, 409, "STORY_OWNER", STORY_OWNER_MESSAGE);
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
      if (await ownsStoryMaps(deps.db, id)) {
        return apiError(c, 409, "STORY_OWNER", STORY_OWNER_MESSAGE);
      }
      const [result] = await deps.db.delete(users).where(eq(users.id, id));
      if (result.affectedRows === 0) {
        return apiError(c, 404, "NOT_FOUND", messages.notFound);
      }
      return c.json({ ok: true }, 200);
    });
}
