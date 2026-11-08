import { readdirSync } from "node:fs";
import { join } from "node:path";
import { dropDatabase } from "../apps/server/src/db/admin.ts";
import {
  DEFAULT_TEST_DATABASE_URL,
  parseDatabaseUrl,
  temporaryDatabaseName,
  withDatabase,
} from "../apps/server/src/db/url.ts";
import { fail, info, paint, paths } from "./lib.ts";

function freePort(): number {
  const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) {
    throw new Error("nincs szabad port a smoke-teszthez");
  }
  return port;
}

const PORT = freePort();
const BASE = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_MS = 250;

class SmokeFailure extends Error {}

function binaryForPlatform(): string {
  if (process.platform === "win32" && process.arch === "x64") {
    return "minescript-windows-x64.exe";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "minescript-linux-x64";
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "minescript-macos-arm64";
  }
  return fail(`Ehhez a platformhoz nincs kiadott bináris: ${process.platform}-${process.arch}`);
}

function check(condition: boolean, label: string): void {
  if (!condition) {
    throw new SmokeFailure(label);
  }
  console.log(paint("green", `  ✓ ${label}`));
}

async function waitForHealth(child: Bun.Subprocess): Promise<Response> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new SmokeFailure(`a bináris idő előtt kilépett (${child.exitCode})`);
    }
    const response = await fetch(`${BASE}/api/health`).catch(() => null);
    if (response?.ok) {
      return response;
    }
    await Bun.sleep(POLL_MS);
  }
  throw new SmokeFailure("a bináris nem válaszolt időben a /api/health végponton");
}

async function runChecks(child: Bun.Subprocess): Promise<void> {
  const health = await waitForHealth(child);
  check(health.status === 200, "/api/health 200");

  const index = await fetch(`${BASE}/`);
  check(
    index.status === 200 && (index.headers.get("content-type") ?? "").includes("text/html"),
    "/ HTML-t ad",
  );

  const wasmFile = readdirSync(join(paths.webDist, "assets")).find((file) =>
    file.endsWith(".wasm"),
  );
  check(wasmFile !== undefined, "a buildben van .wasm");
  const wasm = await fetch(`${BASE}/assets/${wasmFile}`);
  check(wasm.headers.get("content-type") === "application/wasm", ".wasm application/wasm típussal");

  const spa = await fetch(`${BASE}/play/1`);
  check((spa.headers.get("content-type") ?? "").includes("text/html"), "SPA-fallback működik");

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ username: "demo1", password: "demo2026" }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  check(login.status === 200 && cookie.startsWith("ms_session="), "a demo-login sikeres");

  const maps = await fetch(`${BASE}/api/maps`, { headers: { Cookie: cookie } });
  const body = (await maps.json()) as { maps?: unknown[] };
  check(maps.status === 200 && (body.maps?.length ?? 0) >= 8, "a seedelt térképek elérhetők");

  child.kill("SIGTERM");
  check((await child.exited) === 0, "SIGTERM-re szabályosan leáll");
}

const binary = join(paths.release, binaryForPlatform());
const databaseUrl = withDatabase(
  process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
  temporaryDatabaseName("smoke"),
);
info(`Indítás: ${binary} (ideiglenes MySQL-adatbázissal)`);
const child = Bun.spawn([binary, "--no-open", "--port", String(PORT)], {
  stdout: "ignore",
  stderr: "pipe",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
const stderr = new Response(child.stderr).text();

let failure: string | null = null;
try {
  await runChecks(child);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  child.kill();
  await child.exited;
  await dropDatabase(parseDatabaseUrl(databaseUrl));
}

if (failure !== null) {
  fail(`Smoke-teszt hiba: ${failure}\n${await stderr}`);
}
info("A smoke-teszt sikeres, az ideiglenes adatbázis törölve.");
