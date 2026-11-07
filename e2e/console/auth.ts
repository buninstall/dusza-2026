import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./store.ts";

export const passwordFile = join(dataDir, "password.hash");

export function passwordHash(): string | null {
  const fromEnv = process.env.TEST_CONSOLE_PASSWORD_HASH?.trim();
  if (fromEnv) return fromEnv;
  if (!existsSync(passwordFile)) return null;
  const stored = readFileSync(passwordFile, "utf8").trim();
  return stored.startsWith("$argon2") ? stored : null;
}

export async function setPassword(password: string): Promise<void> {
  if (password.length < 12) throw new Error("A jelszó legalább 12 karakter legyen.");
  const hash = await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 3,
  });
  writeFileSync(
    passwordFile,
    `${hash}
`,
    { mode: 0o600 },
  );
  chmodSync(passwordFile, 0o600);
}

export const SESSION_COOKIE = "tc_session";
const IDLE_MS = 30 * 60_000;
const ABSOLUTE_MS = 8 * 60 * 60_000;
const MAX_PASSWORD_LENGTH = 256;
const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 60_000;
const MAX_LOCK_MS = 60 * 60_000;
const GLOBAL_WINDOW_MS = 60_000;
const GLOBAL_MAX_FAILURES = 30;

type Session = { createdAt: number; lastSeen: number; csrf: string };
type Attempts = { failures: number; lockedUntil: number };

const sessions = new Map<string, Session>();
const attempts = new Map<string, Attempts>();
let globalFailures: number[] = [];

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export type LoginResult =
  | { ok: true; token: string; csrf: string }
  | { ok: false; status: 400 | 401 | 429; retryAfterSeconds: number; message: string };

function lockFor(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(BASE_LOCK_MS * 2 ** (failures - FREE_ATTEMPTS), MAX_LOCK_MS);
}

export async function login(
  client: string,
  password: unknown,
  now = Date.now(),
): Promise<LoginResult> {
  const record = attempts.get(client) ?? { failures: 0, lockedUntil: 0 };
  globalFailures = globalFailures.filter((at) => now - at < GLOBAL_WINDOW_MS);
  if (record.lockedUntil > now || globalFailures.length >= GLOBAL_MAX_FAILURES) {
    const until = Math.max(record.lockedUntil, (globalFailures[0] ?? now) + GLOBAL_WINDOW_MS);
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: Math.ceil((until - now) / 1000),
      message: "Túl sok sikertelen próbálkozás. Várj, majd próbáld újra.",
    };
  }
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return { ok: false, status: 400, retryAfterSeconds: 0, message: "Add meg a jelszót." };
  }
  const hash = passwordHash();
  if (!hash) {
    return {
      ok: false,
      status: 401,
      retryAfterSeconds: 0,
      message: "A konzolhoz még nincs jelszó beállítva.",
    };
  }
  const valid = await Bun.password.verify(password, hash).catch(() => false);
  if (!valid) {
    record.failures += 1;
    record.lockedUntil = now + lockFor(record.failures);
    attempts.set(client, record);
    globalFailures.push(now);
    return {
      ok: false,
      status: 401,
      retryAfterSeconds: Math.ceil(lockFor(record.failures) / 1000),
      message: "Hibás jelszó.",
    };
  }
  attempts.delete(client);
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(32).toString("base64url");
  sessions.set(digest(token), { createdAt: now, lastSeen: now, csrf });
  return { ok: true, token, csrf };
}

export function sessionOf(token: string | null, now = Date.now()): Session | null {
  if (!token || token.length > 128) return null;
  const key = digest(token);
  const session = sessions.get(key);
  if (!session) return null;
  if (now - session.lastSeen > IDLE_MS || now - session.createdAt > ABSOLUTE_MS) {
    sessions.delete(key);
    return null;
  }
  session.lastSeen = now;
  return session;
}

export function logout(token: string | null): void {
  if (token) sessions.delete(digest(token));
}

export function csrfMatches(session: Session, header: string | null): boolean {
  if (!header) return false;
  const expected = Buffer.from(session.csrf);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ABSOLUTE_MS / 1000}`;
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function resetAuthState(): void {
  sessions.clear();
  attempts.clear();
  globalFailures = [];
}
