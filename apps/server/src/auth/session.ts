import { and, eq, gt, lte } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sessions, users } from "../db/schema.ts";
import type { Deps, SessionUser } from "../env.ts";
import { randomToken, sha256Hex } from "../lib/crypto.ts";

export const SESSION_COOKIE = "ms_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isHttps(c: Context): boolean {
  const forwarded = c.req.header("x-forwarded-proto");
  return forwarded === "https" || new URL(c.req.url).protocol === "https:";
}

export function createSession(deps: Deps, userId: number): string {
  const token = randomToken();
  deps.db
    .insert(sessions)
    .values({ idHash: sha256Hex(token), userId, expiresAt: deps.now() + SESSION_TTL_MS })
    .run();
  return token;
}

export function findSessionUser(deps: Deps, token: string): SessionUser | null {
  const now = deps.now();
  deps.db.delete(sessions).where(lte(sessions.expiresAt, now)).run();
  const row = deps.db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, sha256Hex(token)), gt(sessions.expiresAt, now)))
    .get();
  return row ?? null;
}

export function deleteSession(deps: Deps, token: string): void {
  deps.db
    .delete(sessions)
    .where(eq(sessions.idHash, sha256Hex(token)))
    .run();
}

export function readSessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttps(c),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
