import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  createEngine,
  type Diagnostic,
  type Engine,
  type MineMap,
  type RunResult,
} from "../../packages/engine/src/index.ts";
import {
  check,
  parseMapText,
  run as referenceRun,
} from "../../tools/reference-interpreter/src/index.ts";
import {
  type Expectation,
  RUN_GROUPS,
  SYNTAX_GROUPS,
} from "../../tools/reference-interpreter/test/kiiras-cases.ts";

const root = join(import.meta.dir, "..", "..");
const wasmPath = join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm");

let cached: { engine: Engine; mtime: number } | null = null;

function engine(): Engine {
  if (!existsSync(wasmPath))
    throw new Error("A WASM-motor nincs lefordítva: futtasd a „WASM-motor fordítása” csomagot.");
  const mtime = statSync(wasmPath).mtimeMs;
  if (!cached || cached.mtime !== mtime)
    cached = { engine: createEngine(readFileSync(wasmPath)), mtime };
  return cached.engine;
}

export type CaseKind = "run" | "syntax";

export type EngineCase = {
  id: string;
  source: "kiírás" | "conformance";
  group: string;
  ref: string;
  name: string;
  kind: CaseKind;
  program: string;
  map: string;
  expected: Expectation & { valid?: boolean; badLines?: number[] };
};

type ConformanceExpected = {
  description?: string;
  specRefs?: string[];
  outcome?: { kind: string; code?: string; line?: number };
  gold?: number;
  steps?: number;
  console?: string[];
  robot?: { row: number; col: number; dir?: string };
  valid?: boolean;
  diagnostics?: { code: string; line?: number }[];
};

const DEFAULT_MAP = "1 1\n>\n";

function conformanceCases(kind: "runtime" | "syntax"): EngineCase[] {
  const dir = join(root, "conformance", kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()
    .map((name) => {
      const read = (file: string) =>
        existsSync(join(dir, name, file)) ? readFileSync(join(dir, name, file), "utf8") : null;
      const expected = JSON.parse(read("expected.json") ?? "{}") as ConformanceExpected;
      const base = {
        id: `conformance/${kind}/${name}`,
        source: "conformance" as const,
        group: `conformance/${kind}`,
        ref: (expected.specRefs ?? []).join(", "),
        name: `${name}: ${expected.description ?? ""}`.trim(),
        program: read("program.ms") ?? "",
        map: read("map.txt") ?? DEFAULT_MAP,
      };
      if (kind === "syntax") {
        return {
          ...base,
          kind: "syntax" as const,
          expected: {
            valid: expected.valid ?? false,
            badLines: (expected.diagnostics ?? []).flatMap((d) => (d.line ? [d.line] : [])),
          },
        };
      }
      const outcome = expected.outcome;
      return {
        ...base,
        kind: "run" as const,
        expected: {
          ...(outcome?.kind === "ok" || outcome?.kind === "runtimeError"
            ? { kind: outcome.kind }
            : {}),
          ...(outcome?.code ? { code: outcome.code } : {}),
          ...(outcome?.line ? { line: outcome.line } : {}),
          ...(expected.steps !== undefined ? { steps: expected.steps } : {}),
          ...(expected.gold !== undefined ? { gold: expected.gold } : {}),
          ...(expected.console ? { console: expected.console } : {}),
          ...(expected.robot ? { robot: expected.robot } : {}),
        },
      };
    });
}

function specCases(): EngineCase[] {
  const runs = RUN_GROUPS.flatMap((group) =>
    group.cases.map(
      ([ref, name, program, map, want], index): EngineCase => ({
        id: `kiiras/${group.title}/${index}`,
        source: "kiírás",
        group: group.title,
        ref,
        name,
        kind: "run",
        program,
        map,
        expected: want,
      }),
    ),
  );
  const syntax = SYNTAX_GROUPS.flatMap((group) =>
    group.cases.map(
      ([ref, name, program, badLines], index): EngineCase => ({
        id: `kiiras/${group.title}/s${index}`,
        source: "kiírás",
        group: group.title,
        ref,
        name,
        kind: "syntax",
        program,
        map: DEFAULT_MAP,
        expected: { valid: badLines.length === 0, badLines },
      }),
    ),
  );
  return [...runs, ...syntax];
}

let catalog: EngineCase[] | null = null;

export function engineCases(): EngineCase[] {
  catalog ??= [...specCases(), ...conformanceCases("runtime"), ...conformanceCases("syntax")];
  return catalog;
}

export type Check = { label: string; ok: boolean; got: string; want: string };

function runChecks(result: RunResult, want: EngineCase["expected"], label: string): Check[] {
  const checks: Check[] = [];
  const outcome = result.outcome;
  const add = (name: string, got: unknown, expected: unknown) =>
    checks.push({
      label: `${label}: ${name}`,
      ok: Bun.deepEquals(got, expected),
      got: JSON.stringify(got),
      want: JSON.stringify(expected),
    });
  if (want.kind) add("kimenet", outcome.kind, want.kind);
  if (want.code !== undefined)
    add("hibakód", outcome.kind === "runtimeError" ? outcome.code : outcome.kind, want.code);
  if (want.line !== undefined)
    add("hibás sor", outcome.kind === "runtimeError" ? outcome.line : null, want.line);
  if (want.steps !== undefined) add("lépésszám", result.steps, want.steps);
  if (want.gold !== undefined) add("arany", result.gold, want.gold);
  if (want.console) add("konzol", result.console, want.console);
  if (want.robot) {
    const { pos, dir } = result.finalRobot;
    add(
      "robot helye",
      { row: pos.row, col: pos.col },
      { row: want.robot.row, col: want.robot.col },
    );
    if (want.robot.dir) add("robot iránya", dir, want.robot.dir);
  }
  if (want.discovered) {
    add(
      "felfedezett mezők",
      result.discovered.map((cell) => `${cell.row},${cell.col}`).sort(),
      want.discovered.map(([row, col]) => `${row},${col}`).sort(),
    );
  }
  return checks;
}

function errorLines(diagnostics: readonly Diagnostic[]): number[] {
  return [
    ...new Set(diagnostics.filter((d) => d.severity === "error").map((d) => d.span.line)),
  ].sort((a, b) => a - b);
}

function comparable(result: RunResult) {
  return JSON.parse(JSON.stringify(result.events)) as unknown[];
}

export type Trace = {
  case: EngineCase | null;
  program: string;
  mapText: string;
  map: MineMap | null;
  mapErrors: string[];
  wasm: RunResult | null;
  reference: RunResult | null;
  syntax: {
    wasm: { line: number; code: string; message: string }[];
    reference: { line: number; code: string }[];
  };
  checks: Check[];
  divergence: number | null;
  verdict: "passed" | "failed";
  durations: { wasmMs: number; referenceMs: number };
};

export function trace(input: { id?: string; program?: string; map?: string }): Trace {
  const found = input.id ? (engineCases().find((item) => item.id === input.id) ?? null) : null;
  if (input.id && !found) throw new Error("Nincs ilyen teszteset.");
  const program = found?.program ?? input.program ?? "";
  const mapText = found?.map ?? input.map ?? DEFAULT_MAP;
  const live = engine();
  const parsed = live.parseMap(mapText);
  const mapErrors = parsed.diagnostics
    .filter((d) => d.severity === "error")
    .map((d) => `${d.span.line}. sor: ${d.message}`);
  const analysis = live.analyze(program);
  const syntax = {
    wasm: analysis.diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => ({ line: d.span.line, code: d.code, message: d.message })),
    reference: check(program).diagnostics.map((d) => ({ line: d.line, code: d.code })),
  };
  let wasm: RunResult | null = null;
  let reference: RunResult | null = null;
  const started = performance.now();
  if (parsed.map) wasm = live.run(program, mapText);
  const middle = performance.now();
  if (parseMapText(mapText).map) reference = referenceRun(program, mapText);
  const finished = performance.now();
  const checks: Check[] = [];
  if (found?.kind === "syntax") {
    const bad = found.expected.badLines ?? [];
    const wasmLines = errorLines(analysis.diagnostics);
    const referenceLines = [...new Set(syntax.reference.map((d) => d.line))].sort((a, b) => a - b);
    if (bad.length === 0) {
      checks.push({
        label: "WASM-motor: helyes program",
        ok: wasmLines.length === 0,
        got: wasmLines.join(", ") || "helyes",
        want: "helyes",
      });
      checks.push({
        label: "referencia: helyes program",
        ok: referenceLines.length === 0,
        got: referenceLines.join(", ") || "helyes",
        want: "helyes",
      });
    } else {
      for (const line of bad) {
        checks.push({
          label: `WASM-motor jelöli a(z) ${line}. sort`,
          ok: wasmLines.includes(line),
          got: wasmLines.join(", ") || "nincs hiba",
          want: String(line),
        });
        checks.push({
          label: `referencia jelöli a(z) ${line}. sort`,
          ok: referenceLines.includes(line),
          got: referenceLines.join(", ") || "nincs hiba",
          want: String(line),
        });
      }
      checks.push({
        label: "a hibás program nem fut",
        ok: wasm?.outcome.kind === "syntaxError" && wasm.steps === 0,
        got: `${wasm?.outcome.kind} ${wasm?.steps}`,
        want: "syntaxError 0",
      });
    }
  } else if (found && wasm && reference) {
    checks.push(
      ...runChecks(wasm, found.expected, "WASM-motor"),
      ...runChecks(reference, found.expected, "referencia"),
    );
  }
  let divergence: number | null = null;
  if (wasm && reference) {
    const a = comparable(wasm);
    const b = comparable(reference);
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      if (!Bun.deepEquals(a[index], b[index])) {
        divergence = index;
        break;
      }
    }
    checks.push({
      label: "a két motor eseményről eseményre egyezik",
      ok: divergence === null,
      got: divergence === null ? "egyezik" : `${divergence + 1}. eseménytől eltér`,
      want: "egyezik",
    });
  }
  return {
    case: found,
    program,
    mapText,
    map: parsed.map,
    mapErrors,
    wasm,
    reference,
    syntax,
    checks,
    divergence,
    verdict: checks.every((item) => item.ok) ? "passed" : "failed",
    durations: {
      wasmMs: Math.round((middle - started) * 100) / 100,
      referenceMs: Math.round((finished - middle) * 100) / 100,
    },
  };
}
