import { afterAll, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(30_000);

import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "minescript-console-test-"));
process.env.TEST_CONSOLE_DATA = dataDir;
const PASSWORD = randomBytes(18).toString("base64url");
process.env.TEST_CONSOLE_PASSWORD_HASH = await Bun.password.hash(PASSWORD, "argon2id");
const PORT = 8787;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const auth = await import("./auth.ts");
const { createHandler } = await import("./server.ts");
const parsers = await import("./parsers.ts");
const scanners = await import("./scanners.ts");
const store = await import("./store.ts");

const { buildUi } = await import("./ui/build.ts");
const runner = await import("./runner.ts");
const assets = await buildUi();
const handler = createHandler({ host: "127.0.0.1", port: PORT, assets });
let client = 0;

function call(path: string, init: RequestInit & { ip?: string; host?: string } = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("host")) headers.set("host", init.host ?? `127.0.0.1:${PORT}`);
  const request = new Request(`${ORIGIN}${path}`, { ...init, headers });
  const ip = init.ip ?? "10.0.0.1";
  return handler(request, { requestIP: () => ({ address: ip }) });
}

function post(path: string, body: unknown, extra: Record<string, string> = {}, ip?: string) {
  return call(path, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
    ...(ip ? { ip } : {}),
  });
}

async function signIn(): Promise<{ cookie: string; csrf: string }> {
  client += 1;
  const response = await post("/api/login", { password: PASSWORD }, {}, `10.1.0.${client}`);
  expect(response.status).toBe(200);
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const page = await (await call("/", { headers: { cookie } })).text();
  const csrf = page.match(/name="csrf-token" content="([^"]+)"/)?.[1] ?? "";
  return { cookie, csrf };
}

beforeEach(() => auth.resetAuthState());
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

describe("jelszókapu", () => {
  test("a helyes jelszó belépteti, HttpOnly és SameSite=Strict munkamenet-sütit ad", async () => {
    const response = await post("/api/login", { password: PASSWORD });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toMatch(/^tc_session=[A-Za-z0-9_-]{43};/);
  });

  test.each([
    ["hibás jelszó", "rossz"],
    ["a helyes jelszó kisbetűsen", PASSWORD.toLowerCase()],
    ["a helyes jelszó szóközzel a végén", `${PASSWORD} `],
    ["a helyes jelszó egy karakterrel rövidebben", PASSWORD.slice(0, -1)],
    ["a helyes jelszó előtte nem törhető szóközzel", ` ${PASSWORD}`],
  ])("%s: 401, nincs süti", async (_label, password) => {
    const response = await post("/api/login", { password });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test.each([
    ["hiányzó jelszó", {}],
    ["üres jelszó", { password: "" }],
    ["szám a szöveg helyett", { password: 12345 }],
    ["tömb a szöveg helyett", { password: [PASSWORD] }],
    ["objektum a szöveg helyett", { password: { $ne: "" } }],
    ["null", { password: null }],
    ["túl hosszú jelszó", { password: "a".repeat(300) }],
  ])("%s: 400, nincs süti", async (_label, body) => {
    const response = await post("/api/login", body);
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("öt hibás próbálkozás után zárolás: a helyes jelszó sem enged be, 429 és Retry-After", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        (await post("/api/login", { password: `rossz${attempt}` }, {}, "10.9.9.9")).status,
      ).toBe(401);
    }
    const locked = await post("/api/login", { password: PASSWORD }, {}, "10.9.9.9");
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(locked.headers.get("set-cookie")).toBeNull();
  });

  test("a zárolás kliensenként külön számít, és lejárat után újra lehet próbálkozni", async () => {
    const start = 1_000_000;
    for (let attempt = 0; attempt < 5; attempt += 1) await auth.login("a", "rossz", start);
    expect((await auth.login("a", PASSWORD, start + 1)).ok).toBe(false);
    expect((await auth.login("b", PASSWORD, start + 1)).ok).toBe(true);
    expect((await auth.login("a", PASSWORD, start + 61_000)).ok).toBe(true);
  });

  test("a sok kliensről érkező hibás próbálkozás globális korlátba ütközik", async () => {
    for (let attempt = 0; attempt < 30; attempt += 1)
      await auth.login(`kliens${attempt}`, "rossz", 5_000_000);
    const result = await auth.login("uj-kliens", PASSWORD, 5_000_001);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(429);
  }, 120_000);

  test("bejelentkezés nélkül csak a belépőoldal látszik, a konzol kódja és adatai nem", async () => {
    const page = await (await call("/")).text();
    expect(page).toContain("/ui/login.js");
    expect(page).not.toContain("/ui/app.js");
    expect(page).not.toContain("csrf-token");
    expect((await call("/ui/login.js")).status).toBe(200);
    expect((await call("/ui/app.js")).status).toBe(401);
    expect((await call("/ui/app.css")).status).toBe(401);
    for (const path of [
      "/api/state",
      "/api/events",
      "/api/findings/export.md",
      "/api/suites/reference/tests",
    ]) {
      expect((await call(path)).status).toBe(401);
    }
    expect((await post("/api/runs", { suiteId: "reference" })).status).toBe(401);
  });

  test("hamis, lejárt vagy kijelentkezett munkamenet-süti nem ad hozzáférést", async () => {
    expect((await call("/api/state", { headers: { cookie: "tc_session=hamis" } })).status).toBe(
      401,
    );
    const { cookie, csrf } = await signIn();
    expect((await call("/api/state", { headers: { cookie } })).status).toBe(200);
    expect((await post("/api/logout", {}, { cookie, "X-CSRF-Token": csrf })).status).toBe(200);
    expect((await call("/api/state", { headers: { cookie } })).status).toBe(401);
  });

  test("a munkamenet 30 perc tétlenség után lejár", async () => {
    const result = await auth.login("idle", PASSWORD, 0);
    if (!result.ok) throw new Error("nem sikerült belépni");
    expect(auth.sessionOf(result.token, 29 * 60_000)).not.toBeNull();
    expect(auth.sessionOf(result.token, 29 * 60_000 + 31 * 60_000)).toBeNull();
  });
});

describe("kérésvédelem", () => {
  test("idegen vagy hiányzó Origin: 403 a belépésre is", async () => {
    const foreign = await call("/api/login", {
      method: "POST",
      headers: { Origin: "http://evil.invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(foreign.status).toBe(403);
    const missing = await call("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(missing.status).toBe(403);
  });

  test("ismeretlen Host fejléc (DNS rebinding): 421", async () => {
    expect((await call("/", { host: "evil.invalid:8787" })).status).toBe(421);
    expect((await call("/api/state", { host: "127.0.0.1.nip.io:8787" })).status).toBe(421);
  });

  test("CSRF-token nélkül vagy hibás tokennel a bejelentkezett állapotváltoztatás is 403", async () => {
    const { cookie, csrf } = await signIn();
    expect((await post("/api/runs", { suiteId: "static-comments" }, { cookie })).status).toBe(403);
    expect(
      (
        await post(
          "/api/runs",
          { suiteId: "static-comments" },
          { cookie, "X-CSRF-Token": `${csrf}x` },
        )
      ).status,
    ).toBe(403);
    expect((await post("/api/queue/clear", {}, { cookie, "X-CSRF-Token": csrf })).status).toBe(200);
  });

  test("csak JSON-objektum törzs fogadható el, a túl nagy törzs 413", async () => {
    const { cookie, csrf } = await signIn();
    const base = { Origin: ORIGIN, cookie, "X-CSRF-Token": csrf };
    expect(
      (
        await call("/api/settings", {
          method: "POST",
          headers: { ...base, "Content-Type": "text/plain" },
          body: "{}",
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await call("/api/settings", {
          method: "POST",
          headers: { ...base, "Content-Type": "application/json" },
          body: "[1]",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("/api/settings", {
          method: "POST",
          headers: { ...base, "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("/api/settings", {
          method: "POST",
          headers: { ...base, "Content-Type": "application/json" },
          body: JSON.stringify({ x: "a".repeat(70_000) }),
        })
      ).status,
    ).toBe(413);
  });

  test("ismeretlen csomag, útvonal-bejárás a célpontban és célpont egészben futó csomagra: 400", async () => {
    const { cookie, csrf } = await signIn();
    const extra = { cookie, "X-CSRF-Token": csrf };
    expect((await post("/api/runs", { suiteId: "rm -rf" }, extra)).status).toBe(400);
    expect(
      (
        await post(
          "/api/runs",
          { suiteId: "reference", target: { file: "../../etc/passwd" } },
          extra,
        )
      ).status,
    ).toBe(400);
    expect(
      (await post("/api/runs", { suiteId: "reference", target: { file: "a;b" } }, extra)).status,
    ).toBe(400);
    expect(
      (await post("/api/runs", { suiteId: "static-secrets", target: { name: "x" } }, extra)).status,
    ).toBe(400);
  });

  test("az élő vizsgálat célcíme csak loopback lehet", async () => {
    const { cookie, csrf } = await signIn();
    const extra = { cookie, "X-CSRF-Token": csrf };
    expect((await post("/api/settings", { baseUrl: "http://example.com" }, extra)).status).toBe(
      400,
    );
    expect((await post("/api/settings", { baseUrl: "http://10.0.0.5:8080" }, extra)).status).toBe(
      400,
    );
    expect((await post("/api/settings", { baseUrl: "file:///etc/passwd" }, extra)).status).toBe(
      400,
    );
    expect((await post("/api/settings", { baseUrl: "http://127.0.0.1:8090" }, extra)).status).toBe(
      200,
    );
  });

  test("minden válaszon szigorú biztonsági fejlécek vannak", async () => {
    for (const response of [
      await call("/"),
      await call("/api/state"),
      await call("/console.css"),
    ]) {
      expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  test("a találat módosítása csak ismert értékeket fogad el", async () => {
    store.findings.push({
      id: "00000000-0000-4000-8000-000000000001",
      fingerprint: "teszt",
      suiteId: "reference",
      title: "<img src=x onerror=alert(1)>",
      file: null,
      line: null,
      message: null,
      details: null,
      severity: "közepes",
      owner: "csapat",
      status: "új",
      note: "",
      firstSeen: 0,
      lastSeen: 0,
      lastRunId: "00000000-0000-4000-8000-000000000002",
      occurrences: 1,
      history: ["failed"],
      flaky: false,
    });
    const { cookie, csrf } = await signIn();
    const path = "/api/findings/00000000-0000-4000-8000-000000000001";
    const patch = (body: unknown) =>
      call(path, {
        method: "PATCH",
        headers: {
          Origin: ORIGIN,
          "Content-Type": "application/json",
          cookie,
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify(body),
      });
    expect((await patch({ status: "törölve" })).status).toBe(400);
    expect((await patch({ owner: "támadó" })).status).toBe(400);
    expect((await patch({ severity: "kritikus" })).status).toBe(400);
    const ok = await call(path, {
      method: "PATCH",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", cookie, "X-CSRF-Token": csrf },
      body: '{"status":"megerősítve","note":"ellenőrizve","__proto__":{"admin":true}}',
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: "megerősítve", note: "ellenőrizve" });
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});

describe("eredményelemzők", () => {
  test("JUnit: sikeres, sikertelen és kihagyott eset, entitások, fájl és sor", () => {
    const xml = `<?xml version="1.0"?><testsuites><testsuite name="test/a.test.ts" file="test/a.test.ts"><testsuite name="csoport" file="test/a.test.ts" line="3"><testcase name="jó &amp; szép" file="test/a.test.ts" line="4" time="0.5"/><testcase name="rossz" file="test/a.test.ts" line="9" time="0.01"><failure type="AssertionError" message="Expected: 1&#10;Received: 2">error: expect(received).toBe(expected)&#10;Expected: 1</failure></testcase><testcase name="ki" file="test/a.test.ts" line="12"><skipped/></testcase></testsuite></testsuite></testsuites>`;
    const cases = parsers.parseJUnit(xml, "tools/x");
    expect(cases.map((item) => [item.name, item.status, item.file, item.line])).toEqual([
      ["csoport › jó & szép", "passed", "tools/x/test/a.test.ts", 4],
      ["csoport › rossz", "failed", "tools/x/test/a.test.ts", 9],
      ["csoport › ki", "skipped", "tools/x/test/a.test.ts", 12],
    ]);
    expect(cases[0]?.durationMs).toBe(500);
    expect(cases[1]?.message).toBe("Expected: 1\nReceived: 2");
    expect(cases[1]?.details).toContain("expect(received)");
  });

  test("Playwright JSON: eltérő, instabil, kihagyott eset és globális hiba", () => {
    const report = {
      suites: [
        {
          title: "a.spec.ts",
          file: "a.spec.ts",
          specs: [
            {
              title: "jó",
              file: "a.spec.ts",
              line: 3,
              tests: [{ status: "expected", results: [{ duration: 10 }] }],
            },
            {
              title: "rossz",
              file: "a.spec.ts",
              line: 7,
              tests: [
                {
                  status: "unexpected",
                  results: [
                    {
                      duration: 20,
                      error: {
                        message: "\u001b[31mTimeout 5000ms\u001b[39m",
                        location: { file: "a.spec.ts", line: 9 },
                      },
                    },
                  ],
                },
              ],
            },
            {
              title: "billegő",
              file: "a.spec.ts",
              line: 11,
              tests: [{ status: "flaky", results: [{}, {}] }],
            },
            {
              title: "ki",
              file: "a.spec.ts",
              line: 15,
              tests: [{ status: "skipped", results: [] }],
            },
          ],
        },
      ],
      errors: [{ message: "SyntaxError: hiba", location: { file: "b.spec.ts", line: 1 } }],
    };
    const cases = parsers.parsePlaywright(JSON.stringify(report), "e2e");
    expect(cases.map((item) => item.status)).toEqual([
      "passed",
      "failed",
      "passed",
      "skipped",
      "failed",
    ]);
    expect(cases[1]).toMatchObject({ message: "Timeout 5000ms", line: 9, file: "e2e/a.spec.ts" });
    expect(cases[2]?.name).toContain("instabil");
  });

  test("libtest: sikertelen teszt a pánik helyével és üzenetével", () => {
    const output = [
      "running 3 tests",
      "test a::jo ... ok",
      "test a::rossz ... FAILED",
      "test a::ki ... ignored",
      "",
      "failures:",
      "",
      "---- a::rossz stdout ----",
      "",
      "thread 'a::rossz' panicked at crates/minescript-core/src/x.rs:42:5:",
      "assertion `left == right` failed",
      "  left: 1",
      " right: 2",
      "note: run with `RUST_BACKTRACE=1`",
      "",
      "failures:",
      "    a::rossz",
      "",
      "test result: FAILED. 1 passed; 1 failed; 1 ignored",
    ].join("\n");
    const cases = parsers.parseLibtest(output);
    expect(cases.map((item) => [item.name, item.status])).toEqual([
      ["a::jo", "passed"],
      ["a::rossz", "failed"],
      ["a::ki", "skipped"],
    ]);
    expect(cases[1]).toMatchObject({
      file: "crates/minescript-core/src/x.rs",
      line: 42,
      message: "assertion `left == right` failed",
    });
  });

  test("Biome GitHub-formátum, tsc mindkét formátuma, clippy és rustfmt", () => {
    const biome = parsers.parseBiomeGithub(
      "::error title=lint/style/useConst,file=apps/web/src/a.ts,line=3,endLine=3,col=1,endColumn=5::Use const%0Ainstead",
    );
    expect(biome[0]).toMatchObject({
      file: "apps/web/src/a.ts",
      line: 3,
      message: "Use const",
      status: "failed",
    });
    const tsc = parsers.parseTypecheck(
      "src/a.ts(4,7): error TS2322: Type 'x' is not assignable.\nsrc/b.ts:9:2 - error TS2304: Cannot find name 'y'.",
    );
    expect(tsc.map((item) => [item.file, item.line])).toEqual([
      ["src/a.ts", 4],
      ["src/b.ts", 9],
    ]);
    const rust = parsers.parseRustDiagnostics(
      "error: unused variable: `x`\n --> crates/a/src/lib.rs:10:9\n\nDiff in crates/a/src/lib.rs:20:\n",
    );
    expect(rust.map((item) => [item.file, item.line])).toEqual([
      ["crates/a/src/lib.rs", 10],
      ["crates/a/src/lib.rs", 20],
    ]);
  });

  test("bun audit JSON: sérülékenység súlyosság szerint", () => {
    const cases = parsers.parseAudit(
      JSON.stringify({
        hono: [
          {
            id: 1,
            title: "XSS",
            severity: "high",
            vulnerable_versions: "<4",
            url: "https://example.test",
          },
        ],
      }),
    );
    expect(cases[0]).toMatchObject({ name: "hono: XSS", severity: "magas", status: "failed" });
    expect(parsers.parseAudit("nincs json")).toEqual([]);
  });
});

describe("beépített vizsgálatok", () => {
  test("a kommentfelismerő megtalálja a kommentet, és nem téveszti meg az URL, a regex, a sablon és a Rust-élettartam", () => {
    const slash = "/";
    const tick = "`";
    const dollar = "$";
    const ts = [
      `const u = "https:${slash}${slash}x.test";`,
      `const r = ${slash}a\\${slash}b${slash};`,
      `const t = ${tick}${dollar}{1} ${slash}${slash}${tick};`,
      `${slash}${slash} komment`,
    ].join("\n");
    expect(scanners.codeComments(ts)).toEqual([4]);
    const regexInTemplate = [
      `const a = ${tick}${dollar}{${slash}x=${slash}.test(s)}${tick};`,
      `const u = new URL(${tick}http:${slash}${slash}127.0.0.1:${dollar}{port}${tick});`,
      `${slash}${slash} valódi komment`,
    ].join("\n");
    expect(scanners.codeComments(regexInTemplate)).toEqual([3]);
    const rust = [
      `fn a<'a>(x: &'a str) -> char { '${slash}' }`,
      `let s = r#"${slash}${slash} nem komment"#;`,
      `${slash}${slash}${slash} doc`,
      `let u = "${slash}${slash}";`,
    ].join("\n");
    expect(scanners.codeComments(rust, true)).toEqual([3]);
    expect(scanners.commentLines("a.yml", "#!/bin/sh\nkey: 1\n  # komment")).toEqual([3]);
    expect(scanners.commentLines("m.sql", "--> statement-breakpoint\n-- komment")).toEqual([2]);
    expect(scanners.commentLines("bun.lock", `${slash}${slash} x`)).toEqual([]);
  });

  test("a titokkereső a helyőrzőket és a változóhivatkozásokat nem jelenti, a valódi titkot igen", () => {
    for (const value of [
      "minescript",
      "****",
      "$$MYSQL_ROOT_PASSWORD",
      `${"$"}{DB_PASS}`,
      "current-password",
      "<jelszo>",
      "CHANGE_ME",
    ]) {
      expect(scanners.isPlaceholder(value)).toBe(true);
    }
    for (const value of ["Xk9#pL2vQ8zR4mW7", "qT7vNw2LpX9cRz4KbH6sYf", "s3cr3t-Pa55w0rd!"]) {
      expect(scanners.isPlaceholder(value)).toBe(false);
    }
  });
});

function sampleFinding(
  id: string,
  extra: Partial<import("./store.ts").Finding> = {},
): import("./store.ts").Finding {
  return {
    id,
    fingerprint: id,
    suiteId: "reference",
    title: `minta ${id}`,
    file: null,
    line: null,
    message: null,
    details: null,
    severity: "közepes",
    owner: "csapat",
    status: "új",
    note: "",
    firstSeen: 1,
    lastSeen: 1,
    lastRunId: "00000000-0000-4000-8000-000000000002",
    occurrences: 1,
    history: ["failed"],
    flaky: false,
    ...extra,
  };
}

describe("2. verzió: felület, összevetés, tömeges műveletek, export", () => {
  test("bejelentkezés után a React-felület kódja és stílusa elérhető, CSRF-tokennel", async () => {
    const { cookie, csrf } = await signIn();
    expect(csrf.length).toBeGreaterThan(20);
    const app = await call("/ui/app.js", { headers: { cookie } });
    expect(app.status).toBe(200);
    expect(app.headers.get("content-type")).toContain("javascript");
    const css = await call("/ui/app.css", { headers: { cookie } });
    expect(css.status).toBe(200);
    expect(await css.text()).toContain("--gold");
  });

  test("a lefordított felületben nincs source map és nincs eval", () => {
    for (const [path, asset] of assets) {
      const text = new TextDecoder().decode(asset.body);
      expect(`${path}: ${/sourceMappingURL=/.test(text)}`).toBe(`${path}: false`);
      if (path.endsWith(".js")) expect(`${path}: ${/\beval\(/.test(text)}`).toBe(`${path}: false`);
    }
  });

  test("két futás összevetése: újonnan elromlott, megjavult, továbbra is hibás, új és eltűnt eset", async () => {
    const make = (id: string, cases: [string, "passed" | "failed"][]) => {
      const run = store.newRun("reference", "összevetés", "", null, null);
      Object.assign(run, {
        id,
        status: "failed",
        cases: cases.map(([key, status]) => ({
          key,
          name: key,
          file: null,
          line: null,
          status,
          durationMs: null,
          message: null,
          details: null,
        })),
      });
    };
    make("00000000-0000-4000-8000-00000000000a", [
      ["marad-hibas", "failed"],
      ["javul", "failed"],
      ["elromlik", "passed"],
      ["eltunik", "passed"],
    ]);
    make("00000000-0000-4000-8000-00000000000b", [
      ["marad-hibas", "failed"],
      ["javul", "passed"],
      ["elromlik", "failed"],
      ["uj", "passed"],
    ]);
    const { cookie } = await signIn();
    const response = await call(
      "/api/compare?a=00000000-0000-4000-8000-00000000000a&b=00000000-0000-4000-8000-00000000000b",
      { headers: { cookie } },
    );
    const body = (await response.json()) as Record<string, { key: string }[]>;
    const keys = (name: string) => (body[name] ?? []).map((item) => item.key);
    expect(keys("newlyFailing")).toEqual(["elromlik"]);
    expect(keys("fixed")).toEqual(["javul"]);
    expect(keys("stillFailing")).toEqual(["marad-hibas"]);
    expect(keys("added")).toEqual(["uj"]);
    expect(keys("removed")).toEqual(["eltunik"]);
    expect((await call("/api/compare?a=x&b=y", { headers: { cookie } })).status).toBe(404);
  });

  test("tömeges módosítás: érvénytelen értéknél semmi sem változik, érvényesnél mind", async () => {
    const ids = ["00000000-0000-4000-8000-0000000000b1", "00000000-0000-4000-8000-0000000000b2"];
    for (const id of ids) store.findings.push(sampleFinding(id));
    const { cookie, csrf } = await signIn();
    const extra = { cookie, "X-CSRF-Token": csrf };
    const statuses = () =>
      store.findings
        .filter((finding) => ids.includes(finding.id))
        .map((finding) => [finding.status, finding.owner]);
    expect((await post("/api/findings/bulk", { ids, status: "nincs-ilyen" }, extra)).status).toBe(
      400,
    );
    expect(
      (await post("/api/findings/bulk", { ids, status: "jelentve", owner: "támadó" }, extra))
        .status,
    ).toBe(400);
    expect(statuses()).toEqual([
      ["új", "csapat"],
      ["új", "csapat"],
    ]);
    expect((await post("/api/findings/bulk", { ids: [], status: "jelentve" }, extra)).status).toBe(
      400,
    );
    const ok = await post(
      "/api/findings/bulk",
      { ids, status: "jelentve", owner: "futozs" },
      extra,
    );
    expect(await ok.json()).toEqual({ updated: 2 });
    expect(statuses()).toEqual([
      ["jelentve", "futozs"],
      ["jelentve", "futozs"],
    ]);
  });

  test("CSV-export: BOM, fejléc, és a táblázatkezelő-képlet semlegesítve; a JSON és a Markdown is letölthető", async () => {
    store.findings.push(
      sampleFinding("00000000-0000-4000-8000-0000000000c1", {
        title: '=HYPERLINK("http://evil.invalid")',
      }),
    );
    const { cookie } = await signIn();
    const response = await call("/api/findings/export.csv?all=1", { headers: { cookie } });
    expect(response.headers.get("content-disposition")).toContain("hibajelentesek.csv");
    const text = await response.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("id,severity,status,owner");
    expect(text).toContain("'=HYPERLINK");
    expect(text).not.toMatch(/,=HYPERLINK/);
    expect(
      Array.isArray(
        await (await call("/api/findings/export.json?all=1", { headers: { cookie } })).json(),
      ),
    ).toBe(true);
    expect(
      await (await call("/api/findings/export.md?all=1", { headers: { cookie } })).text(),
    ).toContain("BUG-001");
  });

  test("lcov-elemző: küszöb alatti fájl hiányosság, a lefedetlen sorok tartományokba vonva, tesztfájl kihagyva", () => {
    const lcov = [
      "SF:src/a.ts",
      "DA:1,1",
      "DA:2,0",
      "DA:3,0",
      "DA:4,1",
      "DA:7,0",
      "end_of_record",
      "SF:src/b.ts",
      "DA:1,3",
      "end_of_record",
      "SF:test/c.test.ts",
      "DA:1,0",
      "end_of_record",
    ].join("\n");
    const cases = parsers.parseLcov(lcov, "tools/x");
    expect(cases.map((item) => [item.file, item.status])).toEqual([
      ["tools/x/src/a.ts", "failed"],
      ["tools/x/src/b.ts", "passed"],
    ]);
    expect(cases[0]?.details).toBe("Lefedetlen sorok: 2–3, 7");
    expect(cases[0]?.line).toBe(2);
  });

  test("élő haladásjelzés: a cargo, a Playwright és a Bun soraiból számol", () => {
    expect(runner.liveVerdict("test parser::a ... ok")).toBe("passed");
    expect(runner.liveVerdict("test parser::b ... FAILED")).toBe("failed");
    expect(runner.liveVerdict("test parser::c ... ignored")).toBe("skipped");
    expect(runner.liveVerdict("  ✓  12 [chromium] › a.spec.ts:3:1 › x (1.2s)")).toBe("passed");
    expect(runner.liveVerdict("  ✘  13 [chromium] › a.spec.ts:9:1 › y (5.0s)")).toBe("failed");
    expect(runner.liveVerdict("(fail) csoport > teszt [1.00ms]")).toBe("failed");
    expect(runner.liveVerdict("test result: ok. 3 passed")).toBeNull();
  });
});

type Flaws = {
  cookieFlags: boolean;
  logoutKeeps: boolean;
  adminOpen: boolean;
  trustClientGold: boolean;
  idor: boolean;
  fixation: boolean;
};

function fakeApp(flaws: Flaws) {
  const users = new Map<string, { password: string; admin: boolean }>();
  const sessions = new Map<string, string>();
  const maps = new Map<number, { owner: string; title: string }>();
  let nextMap = 10;
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url);
      const body = ["GET", "DELETE"].includes(request.method)
        ? {}
        : ((await request.json().catch(() => ({}))) as Record<string, unknown>);
      const token = request.headers.get("cookie")?.match(/ms_session=([^;]+)/)?.[1] ?? "";
      const user = sessions.get(token);
      const issue = (name: string, given?: string) => {
        const id = flaws.fixation && given ? given : crypto.randomUUID();
        sessions.set(id, name);
        const flags = flaws.cookieFlags ? "; Path=/" : "; HttpOnly; SameSite=Lax; Path=/";
        return Response.json(
          { user: { username: name } },
          { status: 201, headers: { "Set-Cookie": `ms_session=${id}${flags}` } },
        );
      };
      if (url.pathname === "/api/health") return Response.json({ ok: true });
      if (url.pathname === "/api/auth/register") {
        const name = String(body.username);
        if ([...users.keys()].some((known) => known.toLowerCase() === name.toLowerCase())) {
          return Response.json({ error: "foglalt" }, { status: 409 });
        }
        users.set(name, {
          password: String(body.password),
          admin: flaws.adminOpen && body.role === "admin",
        });
        return issue(name);
      }
      if (url.pathname === "/api/auth/login") {
        const known = users.get(String(body.username));
        if (!known || known.password !== body.password)
          return Response.json({ error: "hibás" }, { status: 401 });
        return issue(String(body.username), token);
      }
      if (url.pathname === "/api/auth/logout") {
        if (!flaws.logoutKeeps) sessions.delete(token);
        return Response.json(
          { ok: true },
          { headers: { "Set-Cookie": "ms_session=; Max-Age=0; Path=/" } },
        );
      }
      if (!user) return Response.json({ error: "belépés kell" }, { status: 401 });
      if (url.pathname === "/api/auth/me") return Response.json({ user: { username: user } });
      if (url.pathname === "/api/admin/users") {
        return users.get(user)?.admin
          ? Response.json({ users: [] })
          : Response.json({ error: "tilos" }, { status: 403 });
      }
      if (url.pathname === "/api/maps" && request.method === "GET") {
        return Response.json({ maps: [{ id: 1, title: "Nyilvános", versionId: 1 }] });
      }
      if (url.pathname === "/api/maps" && request.method === "POST") {
        const id = nextMap++;
        maps.set(id, { owner: user, title: String(body.title) });
        return Response.json({ map: { id } }, { status: 201 });
      }
      const match = url.pathname.match(/^\/api\/maps\/(\d+)(\/export|\/leaderboard)?$/);
      if (match) {
        const id = Number(match[1]);
        if (id === 1 && match[2] === "/leaderboard") return Response.json({ entries: [] });
        const map = maps.get(id);
        if (!map || (!flaws.idor && map.owner !== user))
          return Response.json({ error: "nincs" }, { status: 404 });
        if (request.method === "DELETE") maps.delete(id);
        return Response.json({ map: { id, title: map.title } });
      }
      if (url.pathname === "/api/runs") {
        const lines = String(body.source ?? "")
          .split("\n")
          .filter(Boolean).length;
        const gold = flaws.trustClientGold && typeof body.gold === "number" ? body.gold : 0;
        const steps = flaws.trustClientGold && typeof body.steps === "number" ? body.steps : lines;
        return Response.json({ run: { id: 1, gold, steps } }, { status: 201 });
      }
      return Response.json({ error: "nincs" }, { status: 404 });
    },
  });
}

async function probeVerdicts(flaws: Flaws): Promise<Record<string, string>> {
  const server = fakeApp(flaws);
  try {
    const { probeWrites } = await import("./probes.ts");
    const cases = await probeWrites(
      new URL(`http://127.0.0.1:${server.port}`),
      () => {},
      new AbortController().signal,
    );
    return Object.fromEntries(
      cases.map((item) => [item.name.split(":")[0] ?? item.name, item.status]),
    );
  } finally {
    server.stop(true);
  }
}

const CORE_PROBES = [
  "Regisztráció",
  "Kijelentkezés után a régi munkamenet-süti érvénytelen",
  "Munkamenet-rögzítés",
  "Tömeges értékadás",
  "IDOR",
  "Ranglista-hamisítás",
];

describe("az írási biztonsági próbák elkapják a hibát (a próbák mutációs tesztje)", () => {
  test("biztonságos kamuszerveren a próbák sikeresek", async () => {
    const result = await probeVerdicts({
      cookieFlags: false,
      logoutKeeps: false,
      adminOpen: false,
      trustClientGold: false,
      idor: false,
      fixation: false,
    });
    for (const name of [...CORE_PROBES, "Felhasználónév-ütközés kis- és nagybetűvel"]) {
      expect(`${name}: ${result[name]}`).toBe(`${name}: passed`);
    }
  }, 60_000);

  for (const [flaw, probe] of [
    ["cookieFlags", "Regisztráció"],
    ["logoutKeeps", "Kijelentkezés után a régi munkamenet-süti érvénytelen"],
    ["fixation", "Munkamenet-rögzítés"],
    ["adminOpen", "Tömeges értékadás"],
    ["idor", "IDOR"],
    ["trustClientGold", "Ranglista-hamisítás"],
  ] as const) {
    test(`beültetett hiba (${flaw}): pontosan a(z) „${probe}” próba jelez`, async () => {
      const flaws: Flaws = {
        cookieFlags: false,
        logoutKeeps: false,
        adminOpen: false,
        trustClientGold: false,
        idor: false,
        fixation: false,
        [flaw]: true,
      };
      const result = await probeVerdicts(flaws);
      expect(`${probe}: ${result[probe]}`).toBe(`${probe}: failed`);
      for (const other of CORE_PROBES.filter((name) => name !== probe)) {
        expect(`${other}: ${result[other]}`).toBe(`${other}: passed`);
      }
    }, 60_000);
  }
});
