import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fail, info, paint, paths } from "./lib.ts";

const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_MS = 250;

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

async function waitForHealth(): Promise<Response> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) {
        return response;
      }
    } catch {
      await Bun.sleep(POLL_MS);
      continue;
    }
    await Bun.sleep(POLL_MS);
  }
  return fail("A bináris nem válaszolt időben a /api/health végponton.");
}

function check(condition: boolean, label: string): void {
  if (!condition) {
    fail(`Smoke-teszt hiba: ${label}`);
  }
  console.log(paint("green", `  ✓ ${label}`));
}

const binary = join(paths.release, binaryForPlatform());
const workDir = mkdtempSync(join(tmpdir(), "minescript-smoke-"));
const child = Bun.spawn(
  [binary, "--no-open", "--port", String(PORT), "--db", join(workDir, "smoke.db")],
  { stdout: "pipe", stderr: "pipe" },
);

try {
  info(`Indítás: ${binary}`);
  const health = await waitForHealth();
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

  info("A smoke-teszt sikeres.");
} finally {
  child.kill();
  await child.exited;
  rmSync(workDir, { recursive: true, force: true });
}
