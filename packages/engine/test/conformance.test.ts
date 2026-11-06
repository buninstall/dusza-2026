import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic, Engine } from "../src/index.ts";
import { loadEngine } from "./load.ts";

const conformanceRoot = join(import.meta.dir, "..", "..", "..", "conformance");

type ExpectedDiagnostic = { code: string; line?: number };

type RuntimeCase = {
  description: string;
  outcome: { kind: string; code?: string; line?: number };
  gold: number;
  steps: number;
  console: string[];
  robot?: { row: number; col: number; dir?: string };
};

type SyntaxCase = { description: string; valid: boolean; diagnostics?: ExpectedDiagnostic[] };

type MapCase = {
  description: string;
  valid: boolean;
  goldTotal?: number;
  reachableGold?: number;
  warnings?: string[];
  diagnostics?: ExpectedDiagnostic[];
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

function errorsOf(diagnostics: Diagnostic[]): { code: string; line: number }[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({ code: diagnostic.code, line: diagnostic.span.line }))
    .sort((a, b) => a.line - b.line);
}

function expectDiagnostics(expected: ExpectedDiagnostic[], diagnostics: Diagnostic[]): void {
  const actual = errorsOf(diagnostics);
  expect(actual.map((d) => d.code)).toEqual(expected.map((d) => d.code));
  expected.forEach((diagnostic, index) => {
    if (diagnostic.line !== undefined) {
      expect(actual[index]?.line).toBe(diagnostic.line);
    }
  });
}

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

describe("conformance: maps", () => {
  for (const dir of caseDirs("maps")) {
    const expected = readExpected<MapCase>(dir);
    test(`${caseName(dir)} — ${expected.description}`, () => {
      const result = engine.parseMap(readText(dir, "map.txt"));
      expect(result.map !== null).toBe(expected.valid);
      if (result.map) {
        const info = engine.mapInfo(result.map);
        if (expected.goldTotal !== undefined) expect(info.goldTotal).toBe(expected.goldTotal);
        if (expected.reachableGold !== undefined) {
          expect(info.reachableGold).toBe(expected.reachableGold);
        }
      }
      if (expected.warnings) {
        const warnings: string[] = [
          ...new Set(result.diagnostics.filter((d) => d.severity === "warning").map((d) => d.code)),
        ];
        expect(warnings).toEqual(expected.warnings);
      }
      expectDiagnostics(expected.diagnostics ?? [], result.diagnostics);
    });
  }
});

describe.skipIf(!process.env.CONFORMANCE)("conformance: syntax", () => {
  for (const dir of caseDirs("syntax")) {
    const expected = readExpected<SyntaxCase>(dir);
    test(`${caseName(dir)} — ${expected.description}`, () => {
      const analysis = engine.analyze(readText(dir, "program.ms"));
      const valid = !analysis.diagnostics.some((d) => d.severity === "error");
      expect(valid).toBe(expected.valid);
      expectDiagnostics(expected.diagnostics ?? [], analysis.diagnostics);
    });
  }
});

describe.skipIf(!process.env.CONFORMANCE)("conformance: runtime", () => {
  for (const dir of caseDirs("runtime")) {
    const expected = readExpected<RuntimeCase>(dir);
    test(`${caseName(dir)} — ${expected.description}`, () => {
      const result = engine.run(readText(dir, "program.ms"), readText(dir, "map.txt"));
      expect<string>(result.outcome.kind).toBe(expected.outcome.kind);
      if (result.outcome.kind === "runtimeError") {
        expect<string>(result.outcome.code).toBe(expected.outcome.code ?? "");
        expect(result.outcome.line).toBe(expected.outcome.line ?? 0);
      }
      expect(result.gold).toBe(expected.gold);
      expect(result.steps).toBe(expected.steps);
      expect(result.console).toEqual(expected.console);
      if (expected.robot) {
        expect(result.finalRobot.pos).toEqual({ row: expected.robot.row, col: expected.robot.col });
        if (expected.robot.dir) expect<string>(result.finalRobot.dir).toBe(expected.robot.dir);
      }
    });
  }
});
