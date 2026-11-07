import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { join } from "node:path";
import { createEngine, type Diagnostic, type Engine, type RunResult } from "@minescript/engine";
import { check, parseMapText, run as referenceRun } from "../src/index.ts";
import {
  DOT,
  EXAMPLE_MAP,
  type Expectation,
  RUN_GROUPS,
  type RunCase,
  SYNTAX_GROUPS,
  type SyntaxCase,
} from "./kiiras-cases.ts";

setDefaultTimeout(120_000);

const root = join(import.meta.dir, "..", "..", "..");
let engine: Engine;

beforeAll(async () => {
  const wasm = await Bun.file(
    join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"),
  ).arrayBuffer();
  engine = createEngine(wasm);
});

function runners(): [string, (src: string, map: string) => RunResult][] {
  return [
    ["WASM-motor", (src, map) => engine.run(src, map)],
    ["referencia", referenceRun],
  ];
}

function verify(result: RunResult, want: Expectation): string[] {
  const problems: string[] = [];
  const outcome = result.outcome;
  if (want.kind && outcome.kind !== want.kind)
    problems.push(`kimenet: ${outcome.kind}, elvárt: ${want.kind}`);
  if (want.code !== undefined) {
    const code = outcome.kind === "runtimeError" ? outcome.code : outcome.kind;
    if (code !== want.code) problems.push(`hibakód: ${code}, elvárt: ${want.code}`);
  }
  if (want.line !== undefined) {
    const line = outcome.kind === "runtimeError" ? outcome.line : null;
    if (line !== want.line) problems.push(`hibasor: ${line}, elvárt: ${want.line}`);
  }
  if (want.steps !== undefined && result.steps !== want.steps)
    problems.push(`lépésszám: ${result.steps}, elvárt: ${want.steps}`);
  if (want.gold !== undefined && result.gold !== want.gold)
    problems.push(`arany: ${result.gold}, elvárt: ${want.gold}`);
  if (want.console && !Bun.deepEquals(result.console, want.console)) {
    problems.push(
      `konzol: ${JSON.stringify(result.console.slice(0, 12))}, elvárt: ${JSON.stringify(want.console.slice(0, 12))}`,
    );
  }
  if (want.robot) {
    const { pos, dir } = result.finalRobot;
    if (
      pos.row !== want.robot.row ||
      pos.col !== want.robot.col ||
      (want.robot.dir && dir !== want.robot.dir)
    ) {
      problems.push(
        `robot: (${pos.row},${pos.col}) ${dir}, elvárt: (${want.robot.row},${want.robot.col}) ${want.robot.dir ?? ""}`,
      );
    }
  }
  if (want.discovered) {
    const got = result.discovered.map((cell) => `${cell.row},${cell.col}`).sort();
    const expected = want.discovered.map(([row, col]) => `${row},${col}`).sort();
    if (!Bun.deepEquals(got, expected))
      problems.push(`felfedezett: ${got.join(" ")}, elvárt: ${expected.join(" ")}`);
  }
  return problems;
}

function runGroup(title: string, cases: RunCase[]) {
  describe(title, () => {
    for (const [ref, name, program, map, want] of cases) {
      test(`[${ref}] ${name}`, () => {
        for (const [label, execute] of runners()) {
          const problems = verify(execute(program, map), want);
          expect(`${label}: ${problems.join("; ") || "rendben"}`).toBe(`${label}: rendben`);
        }
      });
    }
  });
}

function errorLines(diagnostics: readonly Diagnostic[]): number[] {
  return [
    ...new Set(diagnostics.filter((d) => d.severity === "error").map((d) => d.span.line)),
  ].sort((a, b) => a - b);
}

function syntaxGroup(title: string, cases: SyntaxCase[]) {
  describe(title, () => {
    for (const [ref, name, program, badLines] of cases) {
      test(`[${ref}] ${name}`, () => {
        const fromEngine = errorLines(engine.analyze(program).diagnostics);
        const fromReference = [...new Set(check(program).diagnostics.map((d) => d.line))].sort(
          (a, b) => a - b,
        );
        if (badLines.length === 0) {
          expect(`WASM-motor: ${fromEngine.join(",") || "helyes"}`).toBe("WASM-motor: helyes");
          expect(`referencia: ${fromReference.join(",") || "helyes"}`).toBe("referencia: helyes");
          return;
        }
        for (const line of badLines) {
          expect(`WASM-motor jelöli a(z) ${line}. sort: ${fromEngine.includes(line)}`).toBe(
            `WASM-motor jelöli a(z) ${line}. sort: true`,
          );
          expect(`referencia jelöli a(z) ${line}. sort: ${fromReference.includes(line)}`).toBe(
            `referencia jelöli a(z) ${line}. sort: true`,
          );
        }
        const result = engine.run(program, DOT);
        expect(`a hibás program nem fut: ${result.outcome.kind} ${result.steps} lépés`).toBe(
          "a hibás program nem fut: syntaxError 0 lépés",
        );
      });
    }
  });
}

describe("1. A térkép formátuma", () => {
  const parse = (text: string) => ({
    engine: engine.parseMap(text),
    reference: parseMapText(text),
  });

  test("[1] a kiírás példatérképe betölthető: 3 sor, 15 oszlop, a robot a 3. sor 12. oszlopában kelet felé néz, 2 aranyrög", () => {
    for (const [label, result] of Object.entries(parse(EXAMPLE_MAP))) {
      const map = result.map;
      expect(
        `${label}: ${map ? `${map.rows}×${map.cols} (${map.robot.row},${map.robot.col}) ${map.dir}` : "érvénytelen"}`,
      ).toBe(`${label}: 3×15 (2,11) east`);
      expect(`${label} arany: ${map?.cells.flat().filter((cell) => cell === "gold").length}`).toBe(
        `${label} arany: 2`,
      );
    }
  });

  const VALID: [string, string][] = [
    ["1×1-es térkép (minimum)", "1 1\n>\n"],
    ["15×15-ös térkép (maximum)", `15 15\n>${".".repeat(14)}\n${`${".".repeat(15)}\n`.repeat(14)}`],
    ["1×15-ös térkép", `1 15\n>${".".repeat(14)}\n`],
    ["15×1-es térkép", `15 1\n>\n${".\n".repeat(14)}`],
    ["minden mezőtípus: üres, arany, fal, robot", "2 3\n.@#\n>..\n"],
  ];
  for (const [name, text] of VALID) {
    test(`[1] érvényes: ${name}`, () => {
      for (const [label, result] of Object.entries(parse(text)))
        expect(`${label}: ${result.map !== null}`).toBe(`${label}: true`);
    });
  }

  for (const [symbol, dir] of [
    [">", "east"],
    ["<", "west"],
    ["^", "north"],
    ["v", "south"],
  ] as const) {
    test(`[1] a(z) ${symbol} robot ${dir === "east" ? "kelet" : dir === "west" ? "nyugat" : dir === "north" ? "észak" : "dél"} felé néz`, () => {
      for (const [label, result] of Object.entries(parse(`1 2\n${symbol}.\n`)))
        expect(`${label}: ${result.map?.dir}`).toBe(`${label}: ${dir}`);
    });
  }

  const INVALID: [string, string][] = [
    ["0 sor", "0 1\n"],
    ["0 oszlop", "1 0\n\n"],
    ["16 sor", `16 1\n>\n${".\n".repeat(15)}`],
    ["16 oszlop", `1 16\n>${".".repeat(15)}\n`],
    ["nincs robot", "1 2\n..\n"],
    ["két robot", "1 2\n><\n"],
    ["négy robot", "2 2\n><\n^v\n"],
    ["kevesebb sor, mint a fejlécben", "2 2\n>.\n"],
    ["több sor, mint a fejlécben", "1 2\n>.\n..\n"],
    ["rövid sor", "2 3\n>..\n..\n"],
    ["hosszú sor", "1 2\n>..\n"],
    ["ismeretlen karakter", "1 2\n>x\n"],
    ["a két dimenzió két szóközzel elválasztva", "1  2\n>.\n"],
    ["hiányzó második dimenzió", "1\n>\n"],
    ["nem számjegyes dimenzió", "a b\n>.\n"],
    ["üres fájl", ""],
  ];
  for (const [name, text] of INVALID) {
    test(`[1] hibás formátum, nem tölthető be, érthető magyar hibaüzenettel: ${name}`, () => {
      const results = parse(text);
      for (const [label, result] of Object.entries(results)) {
        expect(`${label}: ${result.map === null}`).toBe(`${label}: true`);
        const messages = result.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => d.message);
        expect(
          `${label} hibaüzenet: ${messages.length > 0 && messages.every((m) => m.trim().length > 5)}`,
        ).toBe(`${label} hibaüzenet: true`);
      }
    });
  }

  test("[1] a térkép exportja visszatöltve ugyanazt a térképet adja", () => {
    const map = engine.parseMap(EXAMPLE_MAP).map;
    if (!map) throw new Error("A példatérkép nem tölthető be.");
    expect(engine.serializeMap(map)).toBe(EXAMPLE_MAP);
  });
});

for (const group of RUN_GROUPS) runGroup(group.title, group.cases);
for (const group of SYNTAX_GROUPS) syntaxGroup(group.title, group.cases);

describe("3. Indításkor a térkép és a robot alaphelyzetbe kerül", () => {
  test("[3] két egymás utáni futás azonos eredményt ad: a kibányászott arany a következő futásban újra ott van", () => {
    for (const [label, execute] of runners()) {
      const first = execute("step forward 1\nmine here", "1 2\n>@\n");
      const second = execute("step forward 1\nmine here", "1 2\n>@\n");
      expect(`${label}: ${first.gold} ${second.gold} ${second.outcome.kind}`).toBe(
        `${label}: 1 1 ok`,
      );
      expect(`${label} kezdőhely: ${second.events[0]?.robot.pos.col}`).toBe(
        `${label} kezdőhely: 1`,
      );
    }
  });
});
