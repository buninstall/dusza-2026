import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { isOverLimit } from "../auth/rate-limit.ts";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionToken,
  setSessionCookie,
} from "../auth/session.ts";
import { users } from "../db/schema.ts";
import type { AppEnv, Deps, SessionUser } from "../env.ts";
import { apiError } from "../lib/errors.ts";
import { clientAddress } from "../lib/request.ts";
import { validationHook } from "../lib/validation.ts";
import { createAccount } from "../services/accounts.ts";
import { credentialsSchema } from "./schemas.ts";

let decoyHash: Promise<string> | null = null;

function decoy(): Promise<string> {
  decoyHash ??= hashPassword(crypto.randomUUID());
  return decoyHash;
}

async function checkPassword(password: string, hash: string | undefined): Promise<boolean> {
  if (hash === undefined) {
    await verifyPassword(password, await decoy());
    return false;
  }
  return verifyPassword(password, hash);
}

function publicUser(user: SessionUser) {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

export function authRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .post("/register", zValidator("json", credentialsSchema, validationHook), async (c) => {
      const { username, password } = c.req.valid("json");
      if (isOverLimit(deps.rates?.register, clientAddress(c))) {
        return apiError(
          c,
          429,
          "RATE_LIMITED",
          "Túl sok regisztráció erről a címről. Várj néhány percet, és próbáld újra.",
        );
      }
      const created = await createAccount(deps, { username, password, role: "user" });
      if (!created) {
        return apiError(c, 409, "USERNAME_TAKEN", "Ez a felhasználónév már foglalt.");
      }
      setSessionCookie(c, await createSession(deps, created.id));
      return c.json({ user: publicUser(created) }, 201);
    })
    .post("/login", zValidator("json", credentialsSchema, validationHook), async (c) => {
      const { username, password } = c.req.valid("json");
      const limiterKey = `${clientAddress(c)}|${username.toLowerCase()}`;
      if (
        deps.limiter.isLimited(limiterKey) ||
        isOverLimit(deps.rates?.loginAddress, clientAddress(c))
      ) {
        return apiError(
          c,
          429,
          "RATE_LIMITED",
          "Túl sok bejelentkezési kísérlet. Várj egy percet, és próbáld újra.",
        );
      }
      deps.limiter.record(limiterKey);
      const [user] = await deps.db.select().from(users).where(eq(users.username, username));
      if (!(await checkPassword(password, user?.passwordHash)) || !user) {
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
