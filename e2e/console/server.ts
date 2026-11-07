import {
  clearedCookie,
  cookieValue,
  csrfMatches,
  login,
  logout,
  passwordFile,
  passwordHash,
  SESSION_COOKIE,
  sessionCookie,
  sessionOf,
  setPassword,
} from "./auth.ts";
import { engineCases, trace } from "./engine.ts";
import {
  cancel,
  clearQueue,
  enqueue,
  findRun,
  liveOf,
  queueState,
  settings,
  subscribe,
  summaryOf,
  tailOf,
} from "./runner.ts";
import {
  bugReport,
  dataDir,
  type Finding,
  type FindingStatus,
  findings,
  persist,
  readLog,
  runs,
} from "./store.ts";
import { discover, SUITES } from "./suites.ts";
import { buildSummary, summaryMarkdown } from "./summary.ts";
import { type Asset, buildUi } from "./ui/build.ts";

const MAX_BODY = 64 * 1024;
const STATUSES: FindingStatus[] = [
  "új",
  "megerősítve",
  "jelentve",
  "javítva",
  "megszűnt",
  "hamis riasztás",
];
const SEVERITIES = ["blokkoló", "magas", "közepes", "alacsony"] as const;
const OWNERS = ["futozs", "gergogyulai", "hgagadev", "csapat"];
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])$/;

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

const PUBLIC_ASSETS = new Set(["/ui/login.js", "/ui/login.css"]);

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

function shell(entry: "login" | "app", csrf: string | null): string {
  return `<!doctype html>
<html lang="hu" data-theme="mine">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="color-scheme" content="dark light" />
    ${csrf ? `<meta name="csrf-token" content="${escapeHtml(csrf)}" />` : ""}
    <title>${entry === "login" ? "Belépés – MineScript tesztkonzol" : "MineScript tesztkonzol"}</title>
    <link rel="stylesheet" href="/ui/${entry}.css" />
  </head>
  <body>
    <div id="root"></div>
    <noscript>A tesztkonzolhoz JavaScript szükséges.</noscript>
    <script type="module" src="/ui/${entry}.js"></script>
  </body>
</html>`;
}

function respond(body: BodyInit | null, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(body, { ...init, headers });
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return respond(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function problem(status: number, message: string, headers: Record<string, string> = {}): Response {
  return json({ error: message }, status, headers);
}

function download(body: string, type: string, filename: string): Response {
  return respond(body, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
    return problem(415, "A kérés törzse csak application/json lehet.");
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY)
    return problem(413, "Túl nagy kéréstörzs.");
  const text = await request.text();
  if (text.length > MAX_BODY) return problem(413, "Túl nagy kéréstörzs.");
  try {
    const value = JSON.parse(text || "{}") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return problem(400, "A törzsnek JSON-objektumnak kell lennie.");
    }
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key]) => key !== "__proto__" && key !== "constructor" && key !== "prototype",
      ),
    );
  } catch {
    return problem(400, "Hibás JSON.");
  }
}

type Peer = { requestIP: (request: Request) => { address: string } | null } | null;

function stateView() {
  return {
    suites: SUITES.map(({ command: _command, builtin: _builtin, ...suite }) => suite),
    runs: runs.slice(-300).map(summaryOf),
    findings,
    queue: queueState(),
    settings,
    dataDir,
    serverTime: Date.now(),
  };
}

const severityRank = (finding: Finding) => SEVERITIES.indexOf(finding.severity);

function ordered(list: readonly Finding[]): Finding[] {
  return [...list].sort((a, b) => severityRank(a) - severityRank(b) || a.firstSeen - b.firstSeen);
}

function exportMarkdown(list: readonly Finding[]): string {
  const sorted = ordered(list);
  const id = (index: number) => `BUG-${String(index + 1).padStart(3, "0")}`;
  return [
    "# Tesztkonzol – hibajelentések",
    "",
    `Készült: ${new Date().toISOString()}`,
    "",
    "| # | Súlyosság | Felelős | Állapot | Teszt |",
    "| - | - | - | - | - |",
    ...sorted.map(
      (finding, index) =>
        `| ${id(index)} | ${finding.severity} | ${finding.owner} | ${finding.status}${finding.flaky ? " (instabil)" : ""} | ${finding.title.replaceAll("|", "\\|")} |`,
    ),
    "",
    ...sorted.map((finding, index) => `## ${id(index)}\n\n${bugReport(finding, index + 1)}\n`),
  ].join("\n");
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function exportCsv(list: readonly Finding[]): string {
  const columns = [
    "id",
    "severity",
    "status",
    "owner",
    "suiteId",
    "title",
    "file",
    "line",
    "message",
    "occurrences",
    "flaky",
    "firstSeen",
    "lastSeen",
    "note",
  ] as const;
  const rows = ordered(list).map((finding) =>
    columns
      .map((column) => {
        const value = finding[column];
        return csvCell(
          column === "firstSeen" || column === "lastSeen"
            ? new Date(value as number).toISOString()
            : value,
        );
      })
      .join(","),
  );
  return `﻿${[columns.join(","), ...rows].join("\r\n")}\r\n`;
}

function selectFindings(url: URL): Finding[] {
  return url.searchParams.get("all") === "1"
    ? findings
    : findings.filter(
        (finding) => !["megszűnt", "hamis riasztás", "javítva"].includes(finding.status),
      );
}

function compareRuns(aId: string, bId: string) {
  const a = findRun(aId);
  const b = findRun(bId);
  if (!a || !b) return null;
  const index = (run: typeof a) => new Map(run.cases.map((item) => [item.key, item]));
  const before = index(a);
  const after = index(b);
  const pick = (predicate: (key: string) => boolean, from: Map<string, (typeof a.cases)[number]>) =>
    [...from.entries()].filter(([key]) => predicate(key)).map(([, item]) => item);
  return {
    a: summaryOf(a),
    b: summaryOf(b),
    newlyFailing: pick(
      (key) => after.get(key)?.status === "failed" && before.get(key)?.status !== "failed",
      after,
    ),
    fixed: pick(
      (key) => before.get(key)?.status === "failed" && after.get(key)?.status === "passed",
      after,
    ),
    stillFailing: pick(
      (key) => before.get(key)?.status === "failed" && after.get(key)?.status === "failed",
      after,
    ),
    added: pick((key) => !before.has(key), after),
    removed: pick((key) => !after.has(key), before),
  };
}

function applyChanges(finding: Finding, body: Record<string, unknown>): string | null {
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status as FindingStatus))
      return "Ismeretlen állapot.";
  }
  if (body.severity !== undefined) {
    if (
      typeof body.severity !== "string" ||
      !(SEVERITIES as readonly string[]).includes(body.severity)
    )
      return "Ismeretlen súlyosság.";
  }
  if (body.owner !== undefined) {
    if (typeof body.owner !== "string" || !OWNERS.includes(body.owner))
      return "Ismeretlen felelős.";
  }
  if (body.note !== undefined) {
    if (typeof body.note !== "string" || body.note.length > 10_000)
      return "Érvénytelen vagy túl hosszú megjegyzés.";
  }
  if (typeof body.status === "string") finding.status = body.status as FindingStatus;
  if (typeof body.severity === "string") finding.severity = body.severity as Finding["severity"];
  if (typeof body.owner === "string") finding.owner = body.owner;
  if (typeof body.note === "string") finding.note = body.note;
  return null;
}

export type ConsoleOptions = { host: string; port: number; assets: Map<string, Asset> };

export function createHandler(options: ConsoleOptions) {
  const hosts = new Set([
    `${options.host}:${options.port}`,
    `127.0.0.1:${options.port}`,
    `localhost:${options.port}`,
  ]);
  const origins = new Set([...hosts].map((host) => `http://${host}`));

  return async (request: Request, peer: Peer): Promise<Response> => {
    const url = new URL(request.url);
    if (!hosts.has(request.headers.get("host") ?? ""))
      return problem(421, "Ismeretlen Host fejléc.");
    const method = request.method.toUpperCase();
    const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
    const session = sessionOf(token);
    const mutating = !["GET", "HEAD"].includes(method);
    if (mutating) {
      const origin = request.headers.get("origin");
      if (!origin || !origins.has(origin)) return problem(403, "Idegen vagy hiányzó Origin.");
    }

    const asset = options.assets.get(url.pathname);
    if (asset && method === "GET") {
      const isPublic = PUBLIC_ASSETS.has(url.pathname) || url.pathname.startsWith("/ui/assets/");
      if (!isPublic && !session) return problem(401, "Bejelentkezés szükséges.");
      return respond(asset.body, { headers: { "Content-Type": asset.type } });
    }
    if (url.pathname === "/" && method === "GET") {
      return respond(shell(session ? "app" : "login", session?.csrf ?? null), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/api/login" && method === "POST") {
      const body = await readJson(request);
      if (body instanceof Response) return body;
      const result = await login(peer?.requestIP(request)?.address ?? "ismeretlen", body.password);
      if (!result.ok) {
        const headers: Record<string, string> =
          result.retryAfterSeconds > 0 ? { "Retry-After": String(result.retryAfterSeconds) } : {};
        return json(
          { error: result.message, retryAfterSeconds: result.retryAfterSeconds },
          result.status,
          headers,
        );
      }
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(result.token) });
    }
    if (!url.pathname.startsWith("/api/")) return problem(404, "Nincs ilyen oldal.");
    if (!session) return problem(401, "Bejelentkezés szükséges.");
    if (mutating && !csrfMatches(session, request.headers.get("x-csrf-token"))) {
      return problem(403, "Hiányzó vagy hibás CSRF-token.");
    }

    if (url.pathname === "/api/logout" && method === "POST") {
      logout(token);
      return json({ ok: true }, 200, { "Set-Cookie": clearedCookie() });
    }
    if (url.pathname === "/api/state" && method === "GET") return json(stateView());
    if (url.pathname === "/api/events" && method === "GET") {
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (event: string, data: unknown) =>
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          send("hello", queueState());
          unsubscribe = subscribe((event, data) => {
            if (!sessionOf(token)) {
              unsubscribe?.();
              controller.close();
              return;
            }
            send(event, data);
          });
          heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
        },
        cancel() {
          unsubscribe?.();
          if (heartbeat) clearInterval(heartbeat);
        },
      });
      return respond(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
    }
    if (url.pathname === "/api/settings" && method === "POST") {
      const body = await readJson(request);
      if (body instanceof Response) return body;
      if (body.baseUrl !== undefined) {
        if (typeof body.baseUrl !== "string") return problem(400, "Érvénytelen cím.");
        try {
          const target = new URL(body.baseUrl);
          if (!/^https?:$/.test(target.protocol) || !LOOPBACK.test(target.hostname)) {
            return problem(400, "Csak helyi (loopback) http(s) cím adható meg.");
          }
          settings.baseUrl = target.origin;
        } catch {
          return problem(400, "Érvénytelen cím.");
        }
      }
      if (body.timeoutMinutes !== undefined) {
        const minutes = body.timeoutMinutes;
        if (
          typeof minutes !== "number" ||
          !Number.isInteger(minutes) ||
          minutes < 1 ||
          minutes > 240
        ) {
          return problem(400, "Az időkorlát 1 és 240 perc közötti egész.");
        }
        settings.timeoutMinutes = minutes;
      }
      return json(settings);
    }
    if (url.pathname === "/api/runs" && method === "POST") {
      const body = await readJson(request);
      if (body instanceof Response) return body;
      const suite = SUITES.find((candidate) => candidate.id === body.suiteId);
      if (!suite) return problem(400, "Ismeretlen tesztcsomag.");
      const raw =
        body.target && typeof body.target === "object"
          ? (body.target as Record<string, unknown>)
          : null;
      const target = raw
        ? {
            ...(typeof raw.file === "string" &&
            /^[\w./-]{1,300}$/.test(raw.file) &&
            !raw.file.includes("..")
              ? { file: raw.file }
              : {}),
            ...(typeof raw.name === "string" && raw.name.length > 0 && raw.name.length <= 500
              ? { name: raw.name }
              : {}),
            ...(typeof raw.line === "number" && Number.isInteger(raw.line) && raw.line > 0
              ? { line: raw.line }
              : {}),
          }
        : null;
      if (target && Object.keys(target).length === 0) return problem(400, "Érvénytelen célpont.");
      if (target && suite.targets === "none")
        return problem(400, "Ez a csomag csak egészében futtatható.");
      const repeat =
        typeof body.repeat === "number" && Number.isInteger(body.repeat)
          ? Math.min(Math.max(body.repeat, 1), 20)
          : 1;
      const randomize = body.randomize === true;
      const deep = body.deep === true;
      const created = Array.from({ length: repeat }, (_, index) =>
        enqueue(
          suite,
          target,
          { randomizeSeed: randomize ? 1000 + index : null, baseUrl: settings.baseUrl, deep },
          repeat > 1
            ? `ismétlés ${index + 1}/${repeat}${randomize ? `, véletlen sorrend (seed ${1000 + index})` : ""}`
            : randomize
              ? "véletlen sorrend (seed 1000)"
              : null,
        ),
      );
      return json({ runs: created.map(summaryOf) }, 202);
    }
    if (url.pathname === "/api/runs/all" && method === "POST") {
      const body = await readJson(request);
      if (body instanceof Response) return body;
      const includeLong = body.includeLong === true;
      const group = typeof body.group === "string" ? body.group : null;
      const ids = Array.isArray(body.suiteIds)
        ? new Set(body.suiteIds.filter((id): id is string => typeof id === "string"))
        : null;
      const chosen = SUITES.filter(
        (suite) =>
          (ids
            ? ids.has(suite.id)
            : (includeLong || !suite.long) && (!group || suite.group === group)) &&
          (ids ||
            !["fuzz-deep", "live-write", "e2e-flaky", "rust-proptest-deep", "kiiras-live"].includes(
              suite.id,
            )),
      );
      if (chosen.length === 0) return problem(400, "Nincs kiválasztott csomag.");
      const sorted = [
        ...chosen.filter((suite) => suite.group === "Előkészítés"),
        ...chosen.filter((suite) => suite.group !== "Előkészítés"),
      ];
      const created = sorted.map((suite) =>
        enqueue(
          suite,
          null,
          { randomizeSeed: null, baseUrl: settings.baseUrl, deep: false },
          "csoportos futás",
        ),
      );
      return json({ runs: created.map(summaryOf) }, 202);
    }
    if (url.pathname === "/api/queue/clear" && method === "POST")
      return json({ removed: clearQueue() });
    if (url.pathname === "/api/summary" && method === "GET") return json(buildSummary());
    if (url.pathname === "/api/summary.md" && method === "GET") {
      return download(summaryMarkdown(buildSummary()), "text/markdown", "tesztosszegzes.md");
    }
    if (url.pathname === "/api/engine/cases" && method === "GET") {
      try {
        return json({
          cases: engineCases().map(({ id, source, group, ref, name, kind }) => ({
            id,
            source,
            group,
            ref,
            name,
            kind,
          })),
        });
      } catch (error) {
        return problem(500, error instanceof Error ? error.message : String(error));
      }
    }
    if (url.pathname === "/api/engine/trace" && method === "GET") {
      try {
        return json(trace({ id: url.searchParams.get("id") ?? "" }));
      } catch (error) {
        return problem(404, error instanceof Error ? error.message : String(error));
      }
    }
    if (url.pathname === "/api/engine/trace" && method === "POST") {
      const body = await readJson(request);
      if (body instanceof Response) return body;
      if (typeof body.program !== "string" || typeof body.map !== "string")
        return problem(400, "Adj meg programot és térképet.");
      if (body.program.length > 20_000 || body.map.length > 2_000)
        return problem(413, "Túl nagy program vagy térkép.");
      try {
        return json(trace({ program: body.program, map: body.map }));
      } catch (error) {
        return problem(500, error instanceof Error ? error.message : String(error));
      }
    }
    if (url.pathname === "/api/compare" && method === "GET") {
      const result = compareRuns(url.searchParams.get("a") ?? "", url.searchParams.get("b") ?? "");
      return result ? json(result) : problem(404, "Nincs ilyen futás.");
    }
    const runMatch = url.pathname.match(/^\/api\/runs\/([0-9a-f-]{36})(\/log|\/cancel|\/live)?$/);
    if (runMatch) {
      const run = findRun(runMatch[1] ?? "");
      if (!run) return problem(404, "Nincs ilyen futás.");
      if (runMatch[2] === "/live" && method === "GET") return json({ cases: liveOf(run.id) });
      if (runMatch[2] === "/cancel" && method === "POST")
        return json({ cancelled: cancel(run.id) });
      if (runMatch[2] === "/log" && method === "GET")
        return download(readLog(run.id), "text/plain", `futas-${run.id}.log`);
      if (!runMatch[2] && method === "GET") {
        const tail = tailOf(run.id);
        return json({
          ...run,
          tail: tail.length ? tail : readLog(run.id).split("\n").slice(-3000),
        });
      }
    }
    const testsMatch = url.pathname.match(/^\/api\/suites\/([a-z0-9-]+)\/tests$/);
    if (testsMatch && method === "GET") {
      const suite = SUITES.find((candidate) => candidate.id === testsMatch[1]);
      if (!suite) return problem(404, "Ismeretlen tesztcsomag.");
      try {
        return json({ tests: await discover(suite) });
      } catch (error) {
        return problem(
          500,
          `A tesztek felderítése nem sikerült: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (url.pathname === "/api/findings/export.md" && method === "GET") {
      return download(exportMarkdown(selectFindings(url)), "text/markdown", "hibajelentesek.md");
    }
    if (url.pathname === "/api/findings/export.json" && method === "GET") {
      return download(
        JSON.stringify(ordered(selectFindings(url)), null, 2),
        "application/json",
        "hibajelentesek.json",
      );
    }
    if (url.pathname === "/api/findings/export.csv" && method === "GET") {
      return download(exportCsv(selectFindings(url)), "text/csv", "hibajelentesek.csv");
    }
    if (url.pathname === "/api/findings/bulk" && method === "POST") {
      const body = await readJson(request);
      if (body instanceof Response) return body;
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === "string")
        : [];
      if (ids.length === 0 || ids.length > 1000) return problem(400, "Adj meg 1–1000 találatot.");
      const { ids: _ids, note: _note, ...changes } = body;
      const targets = findings.filter((finding) => ids.includes(finding.id));
      for (const finding of targets) {
        const error = applyChanges({ ...finding }, changes);
        if (error) return problem(400, error);
      }
      for (const finding of targets) applyChanges(finding, changes);
      persist();
      return json({ updated: targets.length });
    }
    const findingMatch = url.pathname.match(/^\/api\/findings\/([0-9a-f-]{36})(\/report\.md)?$/);
    if (findingMatch) {
      const index = ordered(findings).findIndex((finding) => finding.id === findingMatch[1]);
      const finding = findings.find((candidate) => candidate.id === findingMatch[1]);
      if (!finding) return problem(404, "Nincs ilyen találat.");
      if (findingMatch[2] && method === "GET") {
        return respond(bugReport(finding, index + 1), {
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }
      if (!findingMatch[2] && method === "PATCH") {
        const body = await readJson(request);
        if (body instanceof Response) return body;
        const error = applyChanges(finding, body);
        if (error) return problem(400, error);
        persist();
        return json(finding);
      }
    }
    return problem(404, "Nincs ilyen végpont.");
  };
}

async function readSecretFromStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
  return Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
}

if (import.meta.main && process.argv.includes("--set-password")) {
  try {
    await setPassword(await readSecretFromStdin());
    console.log(`A jelszó hashe elmentve: ${passwordFile}`);
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
} else if (import.meta.main) {
  if (!passwordHash()) {
    console.error(
      [
        "Nincs beállított jelszó. Állítsd be így (a jelszó a szabványos bemenetről jön):",
        "  bun e2e/console/server.ts --set-password < jelszo.txt",
        "vagy add meg egy argon2id hash-t a TEST_CONSOLE_PASSWORD_HASH változóban.",
      ].join("\n"),
    );
    process.exit(1);
  }
  const host = process.env.TEST_CONSOLE_HOST ?? "127.0.0.1";
  const port = Number(process.env.TEST_CONSOLE_PORT ?? "8787");
  if (!/^(127\.\d+\.\d+\.\d+|localhost|::1)$/.test(host)) {
    console.error(
      `A tesztkonzol parancsokat futtat: csak helyi címen indítható (kapott: ${host}).`,
    );
    process.exit(1);
  }
  const assets = await buildUi();
  const handler = createHandler({ host, port, assets });
  const server = Bun.serve({
    hostname: host,
    port,
    idleTimeout: 0,
    maxRequestBodySize: MAX_BODY * 2,
    fetch: (request, current) => handler(request, current),
    error: () => problem(500, "Belső hiba."),
  });
  console.log(`Tesztkonzol: http://${host}:${server.port}  (adatok: ${dataDir})`);
}
