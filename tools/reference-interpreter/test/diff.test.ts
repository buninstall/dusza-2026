import { beforeAll, describe, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createEngine, type Diagnostic, type Engine, type RunResult } from "@minescript/engine";
import { generateInvalidProgram, generateProgram } from "../src/generate.ts";
import { check, parseMapText, run as referenceRun } from "../src/index.ts";

const root = join(import.meta.dir, "..", "..", "..");
const conformance = join(root, "conformance");
const GENERATED_SEEDS = 2000;
const MAX_REPORTS = Number(process.env.DIFF_REPORTS ?? "5");
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Difference = { path: string; reference: Json | undefined; engine: Json | undefined };
type Subject = { label: string; program: string; map?: string };

let engine: Engine;

function attempt(action: () => Json): Json {
  try {
    return action();
  } catch (error) {
    return { thrown: error instanceof Error ? error.message : String(error) };
  }
}

function errorsOf(diagnostics: readonly Diagnostic[]): Json {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({ code: diagnostic.code, line: diagnostic.span.line }))
    .sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}

function comparableRun(result: RunResult): Json {
  const { outcome, ...rest } = result;
  const normalized: Json =
    outcome.kind === "runtimeError"
      ? { kind: outcome.kind, code: outcome.code, line: outcome.line }
      : outcome.kind === "syntaxError"
        ? { kind: outcome.kind, diagnostics: errorsOf(outcome.diagnostics) }
        : { kind: outcome.kind };
  return { outcome: normalized, ...(JSON.parse(JSON.stringify(rest)) as { [key: string]: Json }) };
}

function comparableMap(valid: boolean, diagnostics: readonly Diagnostic[], gold: Json): Json {
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      code: diagnostic.code,
      line: diagnostic.span.line,
    }))
    .sort((a, b) => a.code.localeCompare(b.code) || a.line - b.line);
  return { valid, errors, gold };
}

function firstDifference(
  reference: Json | undefined,
  other: Json | undefined,
  path: string,
): Difference | null {
  if (JSON.stringify(reference) === JSON.stringify(other)) return null;
  const bothObjects =
    typeof reference === "object" &&
    reference !== null &&
    typeof other === "object" &&
    other !== null;
  if (!bothObjects || Array.isArray(reference) !== Array.isArray(other)) {
    return { path: path || "(gyökér)", reference, engine: other };
  }
  const keys = Array.isArray(reference)
    ? Array.from({ length: Math.max(reference.length, (other as Json[]).length) }, (_, i) =>
        String(i),
      )
    : [...new Set([...Object.keys(reference), ...Object.keys(other as object)])];
  for (const key of keys) {
    const left = (reference as { [key: string]: Json })[key];
    const right = (other as { [key: string]: Json })[key];
    const found = firstDifference(
      left,
      right,
      Array.isArray(reference) ? `${path}[${key}]` : path ? `${path}.${key}` : key,
    );
    if (found) return found;
  }
  return { path, reference, engine: other };
}

function numbered(text: string): string {
  return text
    .split("\n")
    .map(
      (line, index) =>
        `${String(index + 1).padStart(3, " ")} | ${JSON.stringify(line).slice(1, -1)}`,
    )
    .join("\n");
}

function describeMismatch(subject: Subject, difference: Difference): string {
  const parts = [
    `▶ ${subject.label}`,
    "program:",
    numbered(subject.program),
    ...(subject.map === undefined ? [] : ["térkép:", numbered(subject.map)]),
    `első eltérő mező: ${difference.path}`,
    `  referencia: ${JSON.stringify(difference.reference)}`,
    `  motor:      ${JSON.stringify(difference.engine)}`,
  ];
  return parts.join("\n");
}

function compare(subject: Subject, reference: Json, other: Json): string | null {
  const difference = firstDifference(reference, other, "");
  return difference ? describeMismatch(subject, difference) : null;
}

function compareRun(subject: Subject & { map: string }): string | null {
  return compare(
    subject,
    attempt(() => comparableRun(referenceRun(subject.program, subject.map))),
    attempt(() => comparableRun(engine.run(subject.program, subject.map))),
  );
}

function compareSyntax(subject: Subject): string | null {
  return compare(
    subject,
    attempt(() =>
      check(subject.program)
        .diagnostics.map(({ code, line }) => ({ code, line }))
        .sort((a, b) => a.line - b.line || a.code.localeCompare(b.code)),
    ),
    attempt(() => errorsOf(engine.analyze(subject.program).diagnostics)),
  );
}

function compareMap(label: string, text: string): string | null {
  const reference = attempt(() => {
    const result = parseMapText(text);
    return comparableMap(
      result.map !== null,
      result.diagnostics,
      result.info ? [result.info.goldTotal, result.info.reachableGold] : null,
    );
  });
  const other = attempt(() => {
    const result = engine.parseMap(text);
    const info = result.map ? engine.mapInfo(result.map) : null;
    return comparableMap(
      result.map !== null,
      result.diagnostics,
      info ? [info.goldTotal, info.reachableGold] : null,
    );
  });
  return compare({ label, program: "", map: text }, reference, other);
}

function report(kind: string, total: number, mismatches: readonly string[]): void {
  if (mismatches.length === 0) return;
  const shown = mismatches.slice(0, MAX_REPORTS).join("\n\n");
  throw new Error(
    `${kind}: ${mismatches.length} eltérés ${total} esetből (az első ${Math.min(MAX_REPORTS, mismatches.length)}):\n\n${shown}`,
  );
}

function caseDirs(kind: string): string[] {
  const dir = join(conformance, kind);
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()
    .map((name) => join(dir, name));
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const nameOf = (dir: string) => dir.split(/[\\/]/).at(-1) ?? dir;
const seeds = Array.from({ length: GENERATED_SEEDS }, (_, index) => index + 1);

describe.skipIf(!process.env.REFERENCE)("referencia ↔ WASM", () => {
  beforeAll(async () => {
    const wasm = await Bun.file(
      join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"),
    ).arrayBuffer();
    engine = createEngine(wasm);
  });

  test("conformance/runtime", () => {
    const dirs = caseDirs("runtime");
    const mismatches = dirs.flatMap((dir) => {
      const found = compareRun({
        label: `runtime/${nameOf(dir)}`,
        program: read(dir, "program.ms"),
        map: read(dir, "map.txt"),
      });
      return found ? [found] : [];
    });
    report("conformance/runtime", dirs.length, mismatches);
  });

  test("conformance/syntax", () => {
    const dirs = caseDirs("syntax");
    const mismatches = dirs.flatMap((dir) => {
      const found = compareSyntax({
        label: `syntax/${nameOf(dir)}`,
        program: read(dir, "program.ms"),
      });
      return found ? [found] : [];
    });
    report("conformance/syntax", dirs.length, mismatches);
  });

  test("conformance/maps", () => {
    const dirs = caseDirs("maps");
    const mismatches = dirs.flatMap((dir) => {
      const found = compareMap(`maps/${nameOf(dir)}`, read(dir, "map.txt"));
      return found ? [found] : [];
    });
    report("conformance/maps", dirs.length, mismatches);
  });

  test(`${GENERATED_SEEDS} generált helyes program: run és analyze`, () => {
    const mismatches = seeds.flatMap((seed) => {
      const generated = generateProgram(seed);
      const subject = {
        label: `seed ${seed} (generateProgram)`,
        program: generated.program,
        map: generated.map,
      };
      const found = compareSyntax(subject) ?? compareRun(subject);
      return found ? [found] : [];
    });
    report("generált helyes programok", seeds.length, mismatches);
  });

  test(`${GENERATED_SEEDS} generált hibás program: analyze és run`, () => {
    const mismatches = seeds.flatMap((seed) => {
      const generated = generateInvalidProgram(seed);
      const subject = {
        label: `seed ${seed} (generateInvalidProgram, ${generated.mutation})`,
        program: generated.program,
        map: generated.map,
      };
      const found = compareSyntax(subject) ?? compareRun(subject);
      return found ? [found] : [];
    });
    report("generált hibás programok", seeds.length, mismatches);
  });

  test(`${GENERATED_SEEDS} generált térkép: parseMap és mapInfo`, () => {
    const mismatches = seeds.flatMap((seed) => {
      const found = compareMap(`seed ${seed} (generateProgram térképe)`, generateProgram(seed).map);
      return found ? [found] : [];
    });
    report("generált térképek", seeds.length, mismatches);
  });
});
