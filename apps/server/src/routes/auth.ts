import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionToken,
  setSessionCookie,
} from "../auth/session.ts";
import { isDuplicateEntry } from "../db/errors.ts";
import { firstRow } from "../db/rows.ts";
import { type User, users } from "../db/schema.ts";
import type { AppEnv, Deps, SessionUser } from "../env.ts";
import { apiError } from "../lib/errors.ts";
import { clientAddress } from "../lib/request.ts";
import { validationHook } from "../lib/validation.ts";
import { credentialsSchema } from "./schemas.ts";

function publicUser(user: SessionUser) {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

async function registerUser(deps: Deps, username: string, password: string): Promise<User | null> {
  try {
    const { id } = firstRow(
      await deps.db
        .insert(users)
        .values({
          username,
          passwordHash: await hashPassword(password),
          role: "user",
          createdAt: deps.now(),
        })
        .$returningId(),
    );
    return firstRow(await deps.db.select().from(users).where(eq(users.id, id)));
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return null;
    }
    throw error;
  }
}

export function authRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .post("/register", zValidator("json", credentialsSchema, validationHook), async (c) => {
      const { username, password } = c.req.valid("json");
      const created = await registerUser(deps, username, password);
      if (!created) {
        return apiError(c, 409, "USERNAME_TAKEN", "Ez a felhasználónév már foglalt.");
      }
      setSessionCookie(c, await createSession(deps, created.id));
      return c.json({ user: publicUser(created) }, 201);
    })
    .post("/login", zValidator("json", credentialsSchema, validationHook), async (c) => {
      const { username, password } = c.req.valid("json");
      const limiterKey = `${clientAddress(c)}|${username.toLowerCase()}`;
      if (deps.limiter.isLimited(limiterKey)) {
        return apiError(
          c,
          429,
          "RATE_LIMITED",
          "Túl sok bejelentkezési kísérlet. Várj egy percet, és próbáld újra.",
        );
      }
      deps.limiter.record(limiterKey);
      const [user] = await deps.db.select().from(users).where(eq(users.username, username));
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return apiError(c, 401, "INVALID_CREDENTIALS", "Hibás felhasználónév vagy jelszó.");
      }
      deps.limiter.reset(limiterKey);
      setSessionCookie(c, await createSession(deps, user.id));
      return c.json({ user: publicUser(user) }, 200);
    })
    .post("/logout", async (c) => {
      const token = readSessionToken(c);
      if (token) {
        await deleteSession(deps, token);
      }
      clearSessionCookie(c);
      return c.json({ ok: true }, 200);
    })
    .get("/me", requireUser(deps), (c) => c.json({ user: publicUser(c.var.user) }, 200));
}
