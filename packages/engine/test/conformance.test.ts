import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as reference from "../../../tools/reference-interpreter/src/index.ts";
import type { Diagnostic, Dir, Engine, Event, MineMap, Pos, RunResult } from "../src/index.ts";
import { loadEngine } from "./load.ts";

const conformanceRoot = join(import.meta.dir, "..", "..", "..", "conformance");

type ExpectedDiagnostic = { code: string; line?: number; col?: number };
type ActualDiagnostic = { code: string; line: number; col: number };
type ExpectedRobot = { row: number; col: number; dir?: string };

type RuntimeCase = {
  description: string;
  outcome: { kind: string; code?: string; line?: number; diagnostics?: ExpectedDiagnostic[] };
  gold: number;
  steps: number;
  console: string[];
  robot?: ExpectedRobot;
  discovered?: Pos[];
  events?: Event[];
};

type SyntaxCase = { description: string; valid: boolean; diagnostics?: ExpectedDiagnostic[] };

type MapCase = {
  description: string;
  valid: boolean;
  goldTotal?: number;
  reachableGold?: number;
  warnings?: string[];
  diagnostics?: ExpectedDiagnostic[];
  robot?: ExpectedRobot;
  unreachable?: Pos[];
};

type MapOutcome = {
  map: MineMap | null;
  diagnostics: Diagnostic[];
  info: { goldTotal: number; reachableGold: number; unreachable: Pos[] } | null;
};

function caseDirs(kind: string): string[] {
  const dir = join(conformanceRoot, kind);
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()
    .map((name) => join(dir, name));
}

function readText(caseDir: string, file: string): string {
  return readFileSync(join(caseDir, file), "utf8");
}

function readExpected<T>(caseDir: string): T {
  return JSON.parse(readText(caseDir, "expected.json")) as T;
}

function caseName(caseDir: string): string {
  return caseDir.split(/[\\/]/).at(-1) ?? caseDir;
}

function errorsOf(diagnostics: Diagnostic[]): ActualDiagnostic[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      code: diagnostic.code,
      line: diagnostic.span.line,
      col: diagnostic.span.colStart,
    }))
    .sort((a, b) => a.line - b.line || a.col - b.col);
}

function expectDiagnostics(expected: ExpectedDiagnostic[], actual: ActualDiagnostic[]): void {
  expect(actual.map((d) => d.code)).toEqual(expected.map((d) => d.code));
  expected.forEach((diagnostic, index) => {
    if (diagnostic.line !== undefined) expect(actual[index]?.line).toBe(diagnostic.line);
    if (diagnostic.col !== undefined) expect(actual[index]?.col).toBe(diagnostic.col);
  });
}

function expectRobot(expected: ExpectedRobot | undefined, pos: Pos | undefined, dir?: Dir): void {
  if (!expected) return;
  expect(pos).toEqual({ row: expected.row, col: expected.col });
  if (expected.dir) expect<string | undefined>(dir).toBe(expected.dir);
}

function expectRun(result: RunResult, expected: RuntimeCase): void {
  expect<string>(result.outcome.kind).toBe(expected.outcome.kind);
  if (result.outcome.kind === "runtimeError") {
    expect<string>(result.outcome.code).toBe(expected.outcome.code ?? "");
    expect(result.outcome.line).toBe(expected.outcome.line ?? 0);
  }
  if (result.outcome.kind === "syntaxError" && expected.outcome.diagnostics) {
    expectDiagnostics(expected.outcome.diagnostics, errorsOf(result.outcome.diagnostics));
  }
  expect(result.gold).toBe(expected.gold);
  expect(result.steps).toBe(expected.steps);
  expect(result.console).toEqual(expected.console);
  expectRobot(expected.robot, result.finalRobot.pos, result.finalRobot.dir);
  if (expected.discovered) expect(result.discovered).toEqual(expected.discovered);
  if (expected.events) expect(result.events).toEqual(expected.events);
}

function expectMap(outcome: MapOutcome, expected: MapCase): void {
  expect(outcome.map !== null).toBe(expected.valid);
  if (outcome.map && outcome.info) {
    if (expected.goldTotal !== undefined) expect(outcome.info.goldTotal).toBe(expected.goldTotal);
    if (expected.reachableGold !== undefined) {
      expect(outcome.info.reachableGold).toBe(expected.reachableGold);
    }
    if (expected.unreachable) expect(outcome.info.unreachable).toEqual(expected.unreachable);
    expectRobot(expected.robot, outcome.map.robot, outcome.map.dir);
  }
  if (expected.warnings) {
    const warnings: string[] = [
      ...new Set(outcome.diagnostics.filter((d) => d.severity === "warning").map((d) => d.code)),
    ];
    expect(warnings).toEqual(expected.warnings);
  }
  expectDiagnostics(expected.diagnostics ?? [], errorsOf(outcome.diagnostics));
}

function wasmMap(engine: Engine, text: string): MapOutcome {
  const result = engine.parseMap(text);
  return { ...result, info: result.map ? engine.mapInfo(result.map) : null };
}

const mapCases = caseDirs("maps").map((dir) => ({ dir, expected: readExpected<MapCase>(dir) }));
const syntaxCases = caseDirs("syntax").map((dir) => ({
  dir,
  expected: readExpected<SyntaxCase>(dir),
}));
const runtimeCases = caseDirs("runtime").map((dir) => ({
  dir,
  expected: readExpected<RuntimeCase>(dir),
}));

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

describe("conformance: maps", () => {
  for (const { dir, expected } of mapCases) {
    test(`${caseName(dir)} — ${expected.description}`, () => {
      expectMap(wasmMap(engine, readText(dir, "map.txt")), expected);
    });
  }
});

describe("conformance: syntax", () => {
  for (const { dir, expected } of syntaxCases) {
    test(`${caseName(dir)} — ${expected.description}`, () => {
      const analysis = engine.analyze(readText(dir, "program.ms"));
      const errors = errorsOf(analysis.diagnostics);
      expect(errors.length === 0).toBe(expected.valid);
      expectDiagnostics(expected.diagnostics ?? [], errors);
    });
  }
});

describe("conformance: runtime", () => {
  for (const { dir, expected } of runtimeCases) {
    test(`${caseName(dir)} — ${expected.description}`, () => {
      expectRun(engine.run(readText(dir, "program.ms"), readText(dir, "map.txt")), expected);
    });
  }
});

describe("conformance: referencia-interpreter", () => {
  describe("maps", () => {
    for (const { dir, expected } of mapCases) {
      test(`${caseName(dir)} — ${expected.description}`, () => {
        expectMap(reference.parseMapText(readText(dir, "map.txt")), expected);
      });
    }
  });

  describe("syntax", () => {
    for (const { dir, expected } of syntaxCases) {
      test(`${caseName(dir)} — ${expected.description}`, () => {
        const result = reference.check(readText(dir, "program.ms"));
        expect(result.valid).toBe(expected.valid);
        expectDiagnostics(expected.diagnostics ?? [], result.diagnostics);
      });
    }
  });

  describe("runtime", () => {
    for (const { dir, expected } of runtimeCases) {
      test(`${caseName(dir)} — ${expected.description}`, () => {
        expectRun(reference.run(readText(dir, "program.ms"), readText(dir, "map.txt")), expected);
      });
    }
  });
});
