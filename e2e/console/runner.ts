import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseAudit,
  parseBiomeGithub,
  parseJUnit,
  parseLcov,
  parseLibtest,
  parsePlaywright,
  parseRustDiagnostics,
  parseTypecheck,
  stripAnsi,
  type TestCase,
} from "./parsers.ts";
import {
  appendLog,
  newRun,
  persist,
  type Run,
  recordFindings,
  runs,
  type Target,
} from "./store.ts";
import { type Command, type Options, root, SUITES, type Suite } from "./suites.ts";

export type Settings = { baseUrl: string; timeoutMinutes: number };
export const settings: Settings = {
  baseUrl: process.env.TEST_CONSOLE_TARGET ?? "http://127.0.0.1:8080",
  timeoutMinutes: 60,
};

type Job = { run: Run; suite: Suite; target: Target | null; options: Options };
type Listener = (event: string, data: unknown) => void;

const queue: Job[] = [];
const listeners = new Set<Listener>();
let active: { job: Job; abort: AbortController; kill: () => void } | null = null;
const tails = new Map<string, string[]>();
const TAIL_LINES = 3000;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: string, data: unknown): void {
  for (const listener of listeners) {
    try {
      listener(event, data);
    } catch {
      listeners.delete(listener);
    }
  }
}

export function summaryOf(run: Run) {
  const { cases: _cases, ...rest } = run;
  return { ...rest, failedCases: run.cases.filter((item) => item.status === "failed").length };
}

export function tailOf(runId: string): string[] {
  return tails.get(runId) ?? [];
}

let pending: Map<string, string[]> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function writeLine(run: Run, text: string): void {
  const clean = stripAnsi(text).replaceAll("\r\n", "\n");
  appendLog(run.id, clean.endsWith("\n") ? clean : `${clean}\n`);
  const lines = clean.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const tail = tails.get(run.id) ?? [];
  tail.push(...lines);
  if (tail.length > TAIL_LINES) tail.splice(0, tail.length - TAIL_LINES);
  tails.set(run.id, tail);
  const batch = pending.get(run.id) ?? [];
  batch.push(...lines);
  pending.set(run.id, batch);
  let moved = false;
  for (const line of lines) {
    const verdict = liveVerdict(line);
    if (!verdict) continue;
    run.progress = run.progress ?? { passed: 0, failed: 0, skipped: 0 };
    run.progress[verdict] += 1;
    moved = true;
  }
  if (moved) progressed.add(run.id);
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const sent = pending;
      pending = new Map();
      for (const [runId, batchLines] of sent) emit("log", { runId, lines: batchLines });
      for (const runId of progressed) {
        const current = runs.find((candidate) => candidate.id === runId);
        if (current) emit("run", summaryOf(current));
      }
      progressed.clear();
    }, 150);
  }
}

const progressed = new Set<string>();

export function liveVerdict(line: string): "passed" | "failed" | "skipped" | null {
  const cargo = line.match(/^test \S+ \.\.\. (ok|FAILED|ignored)/);
  if (cargo) return cargo[1] === "ok" ? "passed" : cargo[1] === "FAILED" ? "failed" : "skipped";
  const playwright = line.match(/^\s+(✓|✘|-|ok|x)\s+\d+ \[/);
  if (playwright)
    return playwright[1] === "✓" || playwright[1] === "ok"
      ? "passed"
      : playwright[1] === "-"
        ? "skipped"
        : "failed";
  const bun = line.match(/^\((pass|fail|skip|todo)\) /);
  if (bun) return bun[1] === "pass" ? "passed" : bun[1] === "fail" ? "failed" : "skipped";
  return null;
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

async function missingPrerequisites(suite: Suite): Promise<string[]> {
  const missing: string[] = [];
  if (
    suite.needs.includes("wasm") &&
    !existsSync(join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"))
  ) {
    missing.push(
      "Hiányzik a lefordított WASM-motor: futtasd előbb a „WASM-motor fordítása” csomagot.",
    );
  }
  if (
    suite.needs.includes("build") &&
    !existsSync(join(root, "apps", "web", "dist", "index.html"))
  ) {
    missing.push(
      "Hiányzik a webes build (apps/web/dist): futtasd előbb a „Teljes build” csomagot.",
    );
  }
  if (suite.needs.includes("db")) {
    const url = new URL(process.env.TEST_DATABASE_URL ?? "mysql://root:minescript@127.0.0.1:3306");
    if (!(await canConnect(url.hostname, Number(url.port || 3306)))) {
      missing.push(
        `A MySQL nem érhető el a(z) ${url.hostname}:${url.port || 3306} címen: indítsd el (just db-up).`,
      );
    }
  }
  if (suite.needs.includes("live")) {
    try {
      const response = await fetch(new URL("/api/health", settings.baseUrl), {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        missing.push(`A célpéldány (${settings.baseUrl}) egészség-végpontja ${response.status}.`);
    } catch {
      missing.push(
        `Nem fut alkalmazás a(z) ${settings.baseUrl} címen: indítsd el (just dev) vagy állítsd át a célcímet.`,
      );
    }
  }
  return missing;
}

function parseOutput(command: Command, output: string): TestCase[] {
  const report =
    command.reportFile && existsSync(command.reportFile)
      ? readFileSync(command.reportFile, "utf8")
      : null;
  switch (command.parser) {
    case "junit":
      return report ? parseJUnit(report, command.reportBase) : [];
    case "playwright":
      return report ? parsePlaywright(report, command.reportBase ?? "e2e") : [];
    case "libtest":
      return parseLibtest(output);
    case "biome":
      return parseBiomeGithub(output);
    case "typecheck":
      return parseTypecheck(output);
    case "rust-diagnostics":
      return parseRustDiagnostics(output);
    case "audit":
      return parseAudit(output);
    case "lcov":
      return report ? parseLcov(report, command.reportBase) : [];
    default:
      return [];
  }
}

function finish(
  run: Run,
  cases: TestCase[],
  exitCode: number | null,
  cancelled: boolean,
  timedOut: boolean,
  outputTail: string,
): void {
  run.exitCode = exitCode;
  run.finishedAt = Date.now();
  const failed = cases.filter((item) => item.status === "failed");
  const testLike = SUITES.find((suite) => suite.id === run.suiteId)?.targets !== "none";
  if (cancelled) {
    run.status = "cancelled";
    run.summary = "A futást leállítottad.";
  } else if (timedOut) {
    run.status = "error";
    run.summary = `Időtúllépés: ${settings.timeoutMinutes} perc után leállítva.`;
  } else if (failed.length > 0) {
    run.status = "failed";
    run.summary = `${failed.length} sikertelen eset.`;
  } else if (exitCode !== 0 && exitCode !== null) {
    run.status = "failed";
    const lines = outputTail.trim().split("\n").slice(-25).join("\n");
    cases.push({
      key: `${run.suiteId}::exit`,
      name: "A parancs hibakóddal lépett ki, és nem adott elemezhető eredményt",
      file: null,
      line: null,
      status: "failed",
      durationMs: null,
      message: `Kilépési kód: ${exitCode}`,
      details: lines,
    });
    run.summary = `Kilépési kód ${exitCode}, elemezhető eset nélkül.`;
  } else if (testLike && cases.filter((item) => item.status === "passed").length === 0) {
    run.status = "failed";
    cases.push({
      key: `${run.suiteId}::empty`,
      name: "Egyetlen teszt sem futott le",
      file: null,
      line: null,
      status: "failed",
      durationMs: null,
      message: "A szűrő nem illeszkedett, vagy a csomag üres: ami nem futott, az nem sikeres.",
      details: outputTail.trim().split("\n").slice(-25).join("\n"),
    });
    run.summary = "Egyetlen teszt sem futott le.";
  } else {
    run.status = "passed";
    run.summary = `${cases.filter((item) => item.status === "passed").length} sikeres eset.`;
  }
  run.cases = cases;
  run.counts = {
    passed: cases.filter((item) => item.status === "passed").length,
    failed: cases.filter((item) => item.status === "failed").length,
    skipped: cases.filter((item) => item.status === "skipped").length,
  };
  const suite = SUITES.find((candidate) => candidate.id === run.suiteId);
  const recorded = recordFindings(
    { ...run, cases: run.target ? cases.filter((item) => !item.key.endsWith("::empty")) : cases },
    suite?.severity ?? "közepes",
    run.target === null,
  );
  run.summary = `${run.summary} Új találat: ${recorded.opened}, megszűnt: ${recorded.resolved}.`;
  persist();
}

function killTree(pid: number, child: { kill: (signal?: number) => void }): void {
  if (process.platform === "win32") {
    Bun.spawnSync(["taskkill", "/PID", String(pid), "/T", "/F"], {
      stdout: "ignore",
      stderr: "ignore",
    });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      child.kill(9);
    }
  }
}

async function execute(job: Job): Promise<void> {
  const { run, suite, target, options } = job;
  const abort = new AbortController();
  run.status = "running";
  run.startedAt = Date.now();
  persist();
  emit("run", summaryOf(run));
  const missing = await missingPrerequisites(suite);
  if (missing.length > 0) {
    for (const line of missing) writeLine(run, `✗ ${line}`);
    run.status = "error";
    run.finishedAt = Date.now();
    run.summary = missing.join(" ");
    run.cases = missing.map((message, index) => ({
      key: `${suite.id}::prerequisite::${index}`,
      name: "Hiányzó előfeltétel",
      file: null,
      line: null,
      status: "failed",
      durationMs: null,
      message,
      details: null,
    }));
    run.counts = { passed: 0, failed: missing.length, skipped: 0 };
    persist();
    emit("run", summaryOf(run));
    return;
  }
  let cancelled = false;
  let timedOut = false;
  if (suite.builtin) {
    active = { job, abort, kill: () => abort.abort() };
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, settings.timeoutMinutes * 60_000);
    let cases: TestCase[] = [];
    try {
      cases = await suite.builtin(
        { root, log: (line) => writeLine(run, line), signal: abort.signal },
        options,
      );
    } catch (error) {
      writeLine(
        run,
        `✗ ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
      cases = [
        {
          key: `${suite.id}::crash`,
          name: "A beépített vizsgálat kivételt dobott",
          file: null,
          line: null,
          status: "failed",
          durationMs: null,
          message: String(error),
          details: error instanceof Error ? (error.stack ?? null) : null,
        },
      ];
    }
    clearTimeout(timer);
    cancelled = abort.signal.aborted && !timedOut;
    finish(run, cases, 0, cancelled, timedOut, tailOf(run.id).join("\n"));
    emit("run", summaryOf(run));
    return;
  }
  const workDir = mkdtempSync(join(tmpdir(), "minescript-console-"));
  const command = suite.command?.(
    target,
    options,
    join(
      workDir,
      suite.reportName ?? (suite.targets === "playwright" ? "report.json" : "report.xml"),
    ),
  );
  if (!command) return;
  run.command = command.cmd
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(" ");
  writeLine(run, `$ ${run.command}\n  (munkakönyvtár: ${command.cwd})`);
  let output = "";
  let exitCode: number | null = null;
  try {
    const child = Bun.spawn(command.cmd, {
      cwd: command.cwd,
      env: { ...process.env, ...command.env, NO_COLOR: "1" },
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    active = { job, abort, kill: () => killTree(child.pid, child) };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid, child);
    }, settings.timeoutMinutes * 60_000);
    abort.signal.addEventListener("abort", () => {
      cancelled = true;
      killTree(child.pid, child);
    });
    const pump = async (stream: ReadableStream<Uint8Array>) => {
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of stream) {
        buffer += decoder.decode(chunk, { stream: true });
        const cut = buffer.lastIndexOf("\n");
        if (cut >= 0) {
          const ready = buffer.slice(0, cut + 1);
          buffer = buffer.slice(cut + 1);
          output += ready;
          writeLine(run, ready);
        }
      }
      if (buffer) {
        output += buffer;
        writeLine(run, buffer);
      }
    };
    await Promise.all([pump(child.stdout), pump(child.stderr)]);
    exitCode = await child.exited;
    clearTimeout(timer);
  } catch (error) {
    writeLine(
      run,
      `✗ A parancs nem indítható: ${error instanceof Error ? error.message : String(error)}`,
    );
    exitCode = -1;
  }
  let cases: TestCase[] = [];
  try {
    cases = parseOutput(command, output);
  } catch (error) {
    writeLine(run, `✗ Az eredmény nem elemezhető: ${String(error)}`);
  }
  rmSync(workDir, { recursive: true, force: true });
  writeLine(run, `— kilépési kód: ${exitCode}`);
  finish(run, cases, exitCode, cancelled, timedOut, output.slice(-20_000));
  emit("run", summaryOf(run));
}

async function pump(): Promise<void> {
  if (active) return;
  const job = queue.shift();
  if (!job) return;
  try {
    await execute(job);
  } finally {
    active = null;
    emit("queue", queueState());
    void pump();
  }
}

export function queueState() {
  return { active: active?.job.run.id ?? null, queued: queue.map((job) => job.run.id) };
}

export function enqueue(
  suite: Suite,
  target: Target | null,
  options: Options,
  label: string | null,
): Run {
  const title = target?.name
    ? `${suite.title} › ${target.name}`
    : target?.file
      ? `${suite.title} › ${target.file}`
      : suite.title;
  const run = newRun(suite.id, title, "", target, label);
  queue.push({ run, suite, target, options });
  emit("run", summaryOf(run));
  emit("queue", queueState());
  void pump();
  return run;
}

export function cancel(runId: string): boolean {
  if (active?.job.run.id === runId) {
    active.abort.abort();
    active.kill();
    return true;
  }
  const index = queue.findIndex((job) => job.run.id === runId);
  if (index < 0) return false;
  const [job] = queue.splice(index, 1);
  if (job) {
    job.run.status = "cancelled";
    job.run.finishedAt = Date.now();
    job.run.summary = "Elindulás előtt törölve a sorból.";
    persist();
    emit("run", summaryOf(job.run));
    emit("queue", queueState());
  }
  return true;
}

export function clearQueue(): number {
  const removed = queue.splice(0, queue.length);
  for (const job of removed) {
    job.run.status = "cancelled";
    job.run.finishedAt = Date.now();
    job.run.summary = "A sor ürítésekor törölve.";
    emit("run", summaryOf(job.run));
  }
  persist();
  emit("queue", queueState());
  return removed.length;
}

export function findRun(runId: string): Run | undefined {
  return runs.find((run) => run.id === runId);
}
