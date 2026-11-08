import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { createApp } from "../src/app.ts";
import { createLoginLimiter, LOGIN_LIMIT } from "../src/auth/rate-limit.ts";
import type { Db } from "../src/db/client.ts";
import { isTransientDbError } from "../src/db/errors.ts";
import { loadEngine } from "../src/engine.ts";
import type { Deps } from "../src/env.ts";
import { TEST_TIMEOUT_MS } from "./timeout.ts";

setDefaultTimeout(TEST_TIMEOUT_MS);

function failingDb(error: Error): Db {
  return new Proxy(
    {},
    {
      get() {
        throw error;
      },
    },
  ) as Db;
}

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

async function appWith(db: Db) {
  const deps: Deps = {
    db,
    engine: await loadEngine(),
    limiter: createLoginLimiter({ ...LOGIN_LIMIT, now: Date.now }),
    now: Date.now,
  };
  const logged: unknown[] = [];
  const app = createApp(deps, { logError: (error) => logged.push(error) });
  return { app, logged };
}

function signedRequest(path: string): Request {
  return new Request(`http://localhost${path}`, { headers: { Cookie: "ms_session=abc" } });
}

describe("átmeneti adatbázis-hiba", () => {
  test("megszakadt kapcsolatnál 503 és Retry-After jön, nem 500", async () => {
    const { app, logged } = await appWith(
      failingDb(withCode("Connection lost", "PROTOCOL_CONNECTION_LOST")),
    );
    const response = await app.fetch(signedRequest("/api/maps/1"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.json()).toEqual({
      error: {
        code: "UNAVAILABLE",
        message: "Az adatbázis pillanatnyilag nem érhető el. Próbáld újra egy pillanat múlva.",
      },
    });
    expect(logged).toHaveLength(1);
  });

  test("a holtpont és a zárolási időtúllépés is átmeneti, más hiba 500 marad", async () => {
    expect(isTransientDbError(withCode("x", "ER_LOCK_DEADLOCK"))).toBe(true);
    expect(isTransientDbError({ cause: withCode("x", "ER_LOCK_WAIT_TIMEOUT") })).toBe(true);
    expect(isTransientDbError(withCode("x", "ER_DUP_ENTRY"))).toBe(false);
    expect(isTransientDbError(new Error("x"))).toBe(false);
    const { app } = await appWith(failingDb(new Error("bug")));
    const response = await app.fetch(signedRequest("/api/maps/1"));
    expect(response.status).toBe(500);
  });
});
