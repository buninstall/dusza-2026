import { randomBytes } from "node:crypto";
import { createApp } from "../src/app.ts";
import { createLoginLimiter, LOGIN_LIMIT } from "../src/auth/rate-limit.ts";
import { dropDatabase } from "../src/db/admin.ts";
import { type Db, openDatabase } from "../src/db/client.ts";
import { migrate } from "../src/db/migrate.ts";
import {
  type DatabaseTarget,
  DEFAULT_TEST_DATABASE_URL,
  parseServerUrl,
  temporaryDatabaseName,
} from "../src/db/url.ts";
import { loadEngine } from "../src/engine.ts";
import type { Deps } from "../src/env.ts";

export const ORIGIN = "http://localhost";
export const SPEC_MAP = "3 15\n....@..........\n.#############.\n.......@...>...\n";

export const testServer = parseServerUrl(
  process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
);

export function testTarget(): DatabaseTarget {
  return { ...testServer, database: temporaryDatabaseName("test", randomBytes(6).toString("hex")) };
}

export type TestDatabase = AsyncDisposable & { target: DatabaseTarget; db: Db };

export async function createTestDatabase(): Promise<TestDatabase> {
  const target = testTarget();
  const database = await openDatabase(target);
  const dispose = async () => {
    await database.close();
    await dropDatabase(target);
  };
  try {
    await migrate(target);
  } catch (error) {
    await dispose();
    throw error;
  }
  return { target, db: database.db, [Symbol.asyncDispose]: dispose };
}

export async function createTestContext() {
  const database = await createTestDatabase();
  let clock = 1_700_000_000_000;
  const now = () => clock;
  const deps: Deps = {
    db: database.db,
    engine: await loadEngine(),
    limiter: createLoginLimiter({ ...LOGIN_LIMIT, now }),
    now,
  };
  const app = createApp(deps, { logError: () => undefined });
  return {
    deps,
    app,
    target: database.target,
    advance(ms: number) {
      clock += ms;
    },
    client: () => new TestClient(app),
    [Symbol.asyncDispose]: () => database[Symbol.asyncDispose](),
  };
}

type App = ReturnType<typeof createApp>;

export class TestClient {
  private cookie: string | undefined;

  constructor(private readonly app: App) {}

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const init: RequestInit = {
      method,
      headers: {
        ...(method === "GET" ? {} : { Origin: ORIGIN }),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    const response = await this.app.request(`${ORIGIN}${path}`, init);
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const pair = setCookie.split(";")[0] ?? "";
      this.cookie = pair.endsWith("=") ? undefined : pair;
    }
    return response;
  }

  get(path: string) {
    return this.request("GET", path);
  }

  post(path: string, body?: unknown) {
    return this.request("POST", path, body ?? {});
  }

  put(path: string, body: unknown) {
    return this.request("PUT", path, body);
  }

  delete(path: string) {
    return this.request("DELETE", path);
  }

  async register(username: string, password = "jelszo1234") {
    const response = await this.post("/api/auth/register", { username, password });
    if (response.status !== 201) {
      throw new Error(`Regisztráció sikertelen: ${response.status}`);
    }
    return (await response.json()) as { user: { id: number; username: string } };
  }
}

export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export type ErrorBody = { error: { code: string; message: string; details?: unknown } };
