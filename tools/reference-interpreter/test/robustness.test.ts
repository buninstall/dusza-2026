import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { join } from "node:path";
import { createEngine, type Diagnostic, type Engine } from "@minescript/engine";
import { check, parseMapText, run as referenceRun } from "../src/index.ts";

setDefaultTimeout(300_000);

const root = join(import.meta.dir, "..", "..", "..");
const MAP = "3 3\n...\n.>.\n...\n";
let engine: Engine;

beforeAll(async () => {
  const wasm = await Bun.file(
    join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"),
  ).arrayBuffer();
  engine = createEngine(wasm);
});

function engineErrors(diagnostics: readonly Diagnostic[]) {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({ code: diagnostic.code, line: diagnostic.span.line }))
    .sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}

function referenceErrors(src: string) {
  return check(src)
    .diagnostics.map(({ code, line }) => ({ code, line }))
    .sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}

function nested(depth: number): string {
  const lines = Array.from({ length: depth }, (_, level) => `${" ".repeat(level)}if true`);
  return `${[...lines, `${" ".repeat(depth)}print 1`].join("\n")}\n`;
}

describe("óriási bemenetek", () => {
  test("100 000 soros program: a limit 1000-nél megállít, a két motor egyezik", () => {
    const src = "print 1\n".repeat(100_000);
    for (const result of [engine.run(src, MAP), referenceRun(src, MAP)]) {
      expect(result.outcome).toMatchObject({
        kind: "runtimeError",
        code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
        line: 1001,
      });
      expect(result.steps).toBe(1000);
      expect(result.console).toHaveLength(1000);
    }
  });

  test("100 000 karakteres azonosító: érvényes, és a két motor ugyanazt írja ki", () => {
    const name = `a${"b".repeat(99_999)}`;
    const src = `set ${name} to 7\nprint ${name}\n`;
    expect(engineErrors(engine.analyze(src).diagnostics)).toEqual([]);
    expect(engine.run(src, MAP).console).toEqual(["7"]);
    expect(referenceRun(src, MAP).console).toEqual(["7"]);
  });

  test("200 szint mélyen beágyazott if: lefut, 201 lépés mindkét motoron", () => {
    const src = nested(200);
    for (const result of [engine.run(src, MAP), referenceRun(src, MAP)]) {
      expect(result.outcome.kind).toBe("ok");
      expect(result.steps).toBe(201);
      expect(result.console).toEqual(["1"]);
    }
  });

  test("2000 szint mély beágyazás: nem omlik össze, a két motor ugyanazt dönti", () => {
    const src = nested(2000);
    const fromEngine = engine.run(src, MAP);
    const fromReference = referenceRun(src, MAP);
    expect(fromEngine.outcome.kind).toBe(fromReference.outcome.kind);
    expect(fromEngine.steps).toBe(fromReference.steps);
  });

  test("1 MB-os térképszöveg érvénytelen, és egyik motor sem dob kivételt", () => {
    const text = `15 15\n${`${".".repeat(1_000_000)}\n`}`;
    expect(engine.parseMap(text).map).toBeNull();
    expect(parseMapText(text).map).toBeNull();
  });

  test("16×16-os térkép érvénytelen (MAP_DIM_RANGE), a 15×15-ös érvényes", () => {
    const row = (width: number) => ".".repeat(width);
    const grid = (size: number) =>
      `${size} ${size}\n>${row(size - 1)}\n${`${row(size)}\n`.repeat(size - 1)}`;
    expect(engine.parseMap(grid(15)).map).not.toBeNull();
    expect(parseMapText(grid(15)).map).not.toBeNull();
    for (const diagnostics of [
      engine.parseMap(grid(16)).diagnostics,
      parseMapText(grid(16)).diagnostics,
    ]) {
      expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("MAP_DIM_RANGE");
    }
  });
});

describe("szokatlan karakterek a programban", () => {
  const SAMPLES: [string, string][] = [
    ["BOM a fájl közepén", "print 1\n\u{feff}print 2\n"],
    ["nem törhető szóköz a tokenek között", "print 1\n"],
    ["teljes szélességű szóköz", "print　1\n"],
    ["NUL karakter", "print 1\u0000\n"],
    ["magányos kocsivissza", "print 1\rprint 2\n"],
    ["jobbról balra író vezérlőkarakter", "print ‮x\n"],
    ["nulla szélességű szóköz", "print​ 1\n"],
    ["emoji azonosító", "set 🪙 to 1\n"],
    ["ékezetes azonosító", "set árany to 1\n"],
    ["görög betűs azonosító", "set α to 1\n"],
    ["függőleges tabulátor", "print\u000b1\n"],
    ["lapdobás", "print 1\u000c\n"],
    ["egyedül álló helyettesítő kód", "print \ud800\n"],
    ["csak szóközök", "   \n"],
    ["hosszú Unicode-sor", `print ${"ő".repeat(50_000)}\n`],
    ["__proto__ azonosító", "set __proto__ to 1\n"],
  ];

  for (const [label, src] of SAMPLES) {
    test(`${label}: szintaktikai hiba, a két motor ugyanazt a kódot és sort adja, nem fut`, () => {
      const fromEngine = engineErrors(engine.analyze(src).diagnostics);
      expect(fromEngine.length).toBeGreaterThan(0);
      expect(fromEngine).toEqual(referenceErrors(src));
      const result = engine.run(src, MAP);
      expect(result.outcome.kind).toBe("syntaxError");
      expect(result.steps).toBe(0);
      expect(result.events).toEqual([]);
    });
  }
});

describe("szokatlan karakterek a térképen", () => {
  const SAMPLES: [string, string][] = [
    ["nem törhető szóköz a fejlécben", "1 2\n>.\n"],
    ["NUL a sorban", "1 2\n>\u0000\n"],
    ["emoji a sorban", "1 2\n>🪙\n"],
    ["teljes szélességű robot", "1 2\n＞.\n"],
    ["magányos kocsivissza", "1 2\n>.\r\n\r"],
    ["negatív méret", "-1 2\n>.\n"],
    ["tizedes méret", "1.5 2\n>.\n"],
    ["csak szóközök", "   \n"],
  ];

  for (const [label, text] of SAMPLES) {
    test(`${label}: érvénytelen, a két motor ugyanazokat a hibakódokat adja`, () => {
      const codes = (diagnostics: readonly Diagnostic[]) =>
        diagnostics
          .filter((diagnostic) => diagnostic.severity === "error")
          .map((diagnostic) => diagnostic.code)
          .sort();
      const fromEngine = engine.parseMap(text);
      const fromReference = parseMapText(text);
      expect(fromEngine.map).toBeNull();
      expect(fromReference.map).toBeNull();
      expect(codes(fromEngine.diagnostics)).toEqual(codes(fromReference.diagnostics));
    });
  }
});
