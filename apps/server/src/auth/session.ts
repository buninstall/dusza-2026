import { and, eq, gt, lte } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sessions, users } from "../db/schema.ts";
import type { Deps, SessionUser } from "../env.ts";
import { randomToken, sha256Hex } from "../lib/crypto.ts";

export const SESSION_COOKIE = "ms_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_PURGE_INTERVAL_MS = 60 * 1000;

const lastPurge = new WeakMap<Deps, number>();

async function purgeExpired(deps: Deps, now: number): Promise<void> {
  const last = lastPurge.get(deps);
  if (last !== undefined && now - last < SESSION_PURGE_INTERVAL_MS && now >= last) {
    return;
  }
  lastPurge.set(deps, now);
  await deps.db.delete(sessions).where(lte(sessions.expiresAt, now));
}

function isHttps(c: Context): boolean {
  const forwarded = c.req.header("x-forwarded-proto");
  return forwarded === "https" || new URL(c.req.url).protocol === "https:";
}

export async function createSession(deps: Deps, userId: number): Promise<string> {
  const token = randomToken();
  await deps.db
    .insert(sessions)
    .values({ idHash: sha256Hex(token), userId, expiresAt: deps.now() + SESSION_TTL_MS });
  return token;
}

export async function findSessionUser(deps: Deps, token: string): Promise<SessionUser | null> {
  const now = deps.now();
  await purgeExpired(deps, now);
  const [row] = await deps.db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, sha256Hex(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(deps: Deps, token: string): Promise<void> {
  await deps.db.delete(sessions).where(eq(sessions.idHash, sha256Hex(token)));
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
