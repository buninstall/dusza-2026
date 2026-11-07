import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Severity, TestCase } from "./parsers.ts";

export type RunStatus = "queued" | "running" | "passed" | "failed" | "error" | "cancelled";

export type Target = { file?: string; name?: string; line?: number };

export type Run = {
  id: string;
  suiteId: string;
  title: string;
  target: Target | null;
  label: string | null;
  status: RunStatus;
  queuedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
  command: string;
  counts: { passed: number; failed: number; skipped: number };
  cases: TestCase[];
  summary: string | null;
  progress?: { passed: number; failed: number; skipped: number };
};

export type FindingStatus =
  | "új"
  | "megerősítve"
  | "jelentve"
  | "javítva"
  | "megszűnt"
  | "hamis riasztás";

export type Finding = {
  id: string;
  fingerprint: string;
  suiteId: string;
  title: string;
  file: string | null;
  line: number | null;
  message: string | null;
  details: string | null;
  severity: Severity;
  owner: string;
  status: FindingStatus;
  note: string;
  firstSeen: number;
  lastSeen: number;
  lastRunId: string;
  occurrences: number;
  history: ("passed" | "failed")[];
  flaky: boolean;
};

const MAX_RUNS = 400;
const MAX_HISTORY = 12;

export const dataDir = process.env.TEST_CONSOLE_DATA ?? join(homedir(), ".minescript-test-console");
const logsDir = join(dataDir, "logs");
mkdirSync(logsDir, { recursive: true });

function load<T>(file: string, fallback: T): T {
  const path = join(dataDir, file);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    renameSync(path, `${path}.corrupt-${Date.now()}`);
    return fallback;
  }
}

function save(file: string, value: unknown): void {
  const path = join(dataDir, file);
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value));
  renameSync(temporary, path);
}

export const runs: Run[] = load<Run[]>("runs.json", []).map((run) =>
  run.status === "running" || run.status === "queued"
    ? {
        ...run,
        status: "error",
        summary: "A konzol újraindult futás közben.",
        finishedAt: run.finishedAt ?? Date.now(),
      }
    : run,
);
export const findings: Finding[] = load<Finding[]>("findings.json", []);

export function persist(): void {
  if (runs.length > MAX_RUNS) runs.splice(0, runs.length - MAX_RUNS);
  save("runs.json", runs);
  save("findings.json", findings);
}

export function newRun(
  suiteId: string,
  title: string,
  command: string,
  target: Target | null,
  label: string | null,
): Run {
  const run: Run = {
    id: randomUUID(),
    suiteId,
    title,
    target,
    label,
    status: "queued",
    queuedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    command,
    counts: { passed: 0, failed: 0, skipped: 0 },
    cases: [],
    summary: null,
  };
  runs.push(run);
  persist();
  return run;
}

export function logPath(runId: string): string {
  if (!/^[0-9a-f-]{36}$/.test(runId)) throw new Error("Érvénytelen futásazonosító.");
  return join(logsDir, `${runId}.log`);
}

export function appendLog(runId: string, text: string): void {
  appendFileSync(logPath(runId), text);
}

export function readLog(runId: string): string {
  const path = logPath(runId);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function fingerprintOf(suiteId: string, item: TestCase): string {
  return createHash("sha256").update(`${suiteId}\u0000${item.key}`).digest("hex").slice(0, 20);
}

export function ownerOf(suiteId: string, file: string | null): string {
  const path = file ?? "";
  if (/^(crates|packages\/engine)\//.test(path) && !path.includes("test/conformance.test.ts"))
    return "gergogyulai";
  if (/^(apps|scripts)\/|^justfile$/.test(path)) return "futozs";
  if (
    /^(conformance|tools\/reference-interpreter|e2e)\//.test(path) &&
    suiteId.startsWith("static-")
  )
    return "hgagadev";
  if (/^(rust|engine|reference|fuzz)/.test(suiteId)) return "gergogyulai";
  if (/^(server|web|e2e|live)/.test(suiteId)) return "futozs";
  return "csapat";
}

export function recordFindings(
  run: Run,
  defaultSeverity: Severity,
  fullScope: boolean,
): { opened: number; resolved: number } {
  let opened = 0;
  let resolved = 0;
  const now = Date.now();
  const seen = new Set<string>();
  for (const item of run.cases) {
    if (item.status === "skipped") continue;
    const fingerprint = fingerprintOf(run.suiteId, item);
    seen.add(fingerprint);
    const existing = findings.find((finding) => finding.fingerprint === fingerprint);
    const outcome: "failed" | "passed" = item.status === "failed" ? "failed" : "passed";
    if (existing) {
      existing.history = [...existing.history, outcome].slice(-MAX_HISTORY);
      existing.flaky = existing.history.includes("passed") && existing.history.includes("failed");
    }
    if (item.status === "failed") {
      if (existing) {
        existing.lastSeen = now;
        existing.lastRunId = run.id;
        existing.occurrences += 1;
        existing.message = item.message;
        existing.details = item.details;
        existing.line = item.line;
        if (existing.status === "megszűnt" || existing.status === "javítva") {
          existing.status = "új";
          existing.note =
            `${existing.note}\nÚjra előfordult: ${new Date(now).toISOString()}`.trim();
        }
      } else {
        opened += 1;
        findings.push({
          id: randomUUID(),
          fingerprint,
          suiteId: run.suiteId,
          title: item.name,
          file: item.file,
          line: item.line,
          message: item.message,
          details: item.details,
          severity: item.severity ?? defaultSeverity,
          owner: ownerOf(run.suiteId, item.file),
          status: "új",
          note: "",
          firstSeen: now,
          lastSeen: now,
          lastRunId: run.id,
          occurrences: 1,
          history: ["failed"],
          flaky: false,
        });
      }
    } else if (existing && !["megszűnt", "hamis riasztás", "javítva"].includes(existing.status)) {
      existing.status = "megszűnt";
      existing.note = `${existing.note}\nSikeresen lefutott: ${new Date(now).toISOString()}`.trim();
      resolved += 1;
    }
  }
  if (fullScope && run.status !== "error" && run.status !== "cancelled") {
    for (const finding of findings) {
      if (finding.suiteId !== run.suiteId || seen.has(finding.fingerprint)) continue;
      if (["új", "megerősítve", "jelentve"].includes(finding.status) && run.status === "passed") {
        finding.status = "megszűnt";
        finding.note =
          `${finding.note}\nA teljes csomag hiba nélkül lefutott: ${new Date(now).toISOString()}`.trim();
        resolved += 1;
      }
    }
  }
  persist();
  return { opened, resolved };
}

export function bugReport(finding: Finding, number: number): string {
  const location = finding.file
    ? `${finding.file}${finding.line ? `:${finding.line}` : ""}`
    : "nem állapítható meg";
  return [
    `ID:            BUG-${String(number).padStart(3, "0")}`,
    `Felelős:       ${finding.owner}`,
    `Terület:       ${finding.suiteId}`,
    `Fájl és sor:   ${location}`,
    `Súlyosság:     ${finding.severity}`,
    `Állapot:       ${finding.status}${finding.flaky ? " (instabil)" : ""}`,
    `Első / utolsó: ${new Date(finding.firstSeen).toISOString()} / ${new Date(finding.lastSeen).toISOString()} (${finding.occurrences}×)`,
    `Teszt:         ${finding.title}`,
    `Tényleges:     ${finding.message ?? "-"}`,
    "",
    "Részletek:",
    "",
    "```",
    (finding.details ?? finding.message ?? "-").slice(0, 20_000),
    "```",
    "",
    finding.note ? `Megjegyzés: ${finding.note}` : "",
  ]
    .join("\n")
    .trimEnd();
}
