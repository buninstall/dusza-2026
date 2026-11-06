import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Diagnostic, RunResult } from "@minescript/engine";

setDefaultTimeout(120_000);

type Patch = { file: string; from: string; to: string };
type Mutant = { name: string; patches: Patch[] };
type ExpectedDiagnostic = { code: string; line?: number; col?: number };
type Reference = {
  run: (src: string, map: string) => RunResult;
  check: (src: string) => {
    valid: boolean;
    diagnostics: { code: string; line: number; col: number }[];
  };
  parseMapText: (text: string) => {
    map: { robot: { row: number; col: number }; dir: string } | null;
    diagnostics: Diagnostic[];
    info: { goldTotal: number; reachableGold: number } | null;
  };
};

const srcDir = join(import.meta.dir, "..", "src");
const conformance = join(import.meta.dir, "..", "..", "..", "conformance");
const workDirs: string[] = [];

const MUTANTS: readonly Mutant[] = [
  {
    name: "az or rövidzáras: igaz bal oldal után nem olvassa be a jobbat",
    patches: [
      {
        file: "evaluate.ts",
        from: "  const right = readSimple(rhs, variables);",
        to: '  if (op === "or" && left.value === true) return boolValue(true);\n  const right = readSimple(rhs, variables);',
      },
    ],
  },
  {
    name: "az and rövidzáras: hamis bal oldal után nem olvassa be a jobbat",
    patches: [
      {
        file: "evaluate.ts",
        from: "  const right = readSimple(rhs, variables);",
        to: '  if (op === "and" && left.value === false) return boolValue(false);\n  const right = readSimple(rhs, variables);',
      },
    ],
  },
  {
    name: "az = és a <> nem ellenőrzi a két operandus típusának egyezését",
    patches: [
      {
        file: "evaluate.ts",
        from: "if (right.kind !== (expected ?? left.kind))",
        to: "if (expected && right.kind !== expected)",
      },
    ],
  },
  {
    name: "a turn by jobbra fordul",
    patches: [
      {
        file: "machine.ts",
        from: '{ east: "north", north: "west", west: "south", south: "east" }',
        to: '{ east: "south", south: "west", west: "north", north: "east" }',
      },
    ],
  },
  {
    name: "a turn by mod 3 szerint számol",
    patches: [
      {
        file: "machine.ts",
        from: "readCount(quarters, machine.variables) % 4",
        to: "readCount(quarters, machine.variables) % 3",
      },
    ],
  },
  {
    name: "a step forward átmegy a falon",
    patches: [
      {
        file: "machine.ts",
        from: 'if (cell === null || cell === "wall") throw',
        to: "if (cell === null) throw",
      },
    ],
  },
  {
    name: "a mine here nem üríti ki a mezőt, újra bányászható",
    patches: [{ file: "machine.ts", from: '  cells[col] = "empty";\n', to: "" }],
  },
  {
    name: "a pályán kívüli isThere üres kamrát lát fal helyett",
    patches: [{ file: "machine.ts", from: '(cell ?? "wall")', to: '(cell ?? "empty")' }],
  },
  {
    name: "az isThere nem fedi fel a célmezőt",
    patches: [
      { file: "machine.ts", from: "  if (cell) discover(machine, draft, target);\n", to: "" },
    ],
  },
  {
    name: "a set nem ellenőrzi a rögzített típust",
    patches: [
      {
        file: "machine.ts",
        from: "if (previous && previous.kind !== value.kind)",
        to: "if (false && previous && previous.kind !== value.kind)",
      },
    ],
  },
  {
    name: "a limit csak az 1002. sornál állít meg",
    patches: [
      {
        file: "machine.ts",
        from: "if (machine.steps === STEP_LIMIT)",
        to: "if (machine.steps === STEP_LIMIT + 1)",
      },
    ],
  },
  {
    name: "az else sora nem számít lépésnek",
    patches: [
      {
        file: "machine.ts",
        from: "    processLine(machine, elseBranch.line, () => undefined);\n",
        to: "",
      },
    ],
  },
  {
    name: "a while utolsó, hamis feltétel-kiértékelése nem számít",
    patches: [
      {
        file: "machine.ts",
        from: "    while (processLine(machine, stmt.line, () => readCondition(kind.cond, machine.variables))) {",
        to: "    while (readCondition(kind.cond, machine.variables) && processLine(machine, stmt.line, () => true)) {",
      },
    ],
  },
  {
    name: "a 101 is érvényes számliterál",
    patches: [
      {
        file: "source.ts",
        from: "export const MAX_LITERAL = 100;",
        to: "export const MAX_LITERAL = 101;",
      },
    ],
  },
  {
    name: "a 16-os térképméret is érvényes",
    patches: [
      {
        file: "source.ts",
        from: "export const MAX_MAP_SIZE = 15;",
        to: "export const MAX_MAP_SIZE = 16;",
      },
    ],
  },
];

function caseDirs(kind: string): string[] {
  const dir = join(conformance, kind);
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()
    .map((name) => join(dir, name));
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const expectedOf = (dir: string) => JSON.parse(read(dir, "expected.json"));
const same = (a: unknown, b: unknown) => Bun.deepEquals(a, b);

function diagnosticsMatch(
  expected: ExpectedDiagnostic[],
  actual: { code: string; line: number; col: number }[],
): boolean {
  if (expected.length !== actual.length) return false;
  return expected.every((want, index) => {
    const got = actual[index];
    if (!got || got.code !== want.code) return false;
    if (want.line !== undefined && got.line !== want.line) return false;
    return want.col === undefined || got.col === want.col;
  });
}

function errorsOf(diagnostics: Diagnostic[]) {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      code: diagnostic.code,
      line: diagnostic.span.line,
      col: diagnostic.span.colStart,
    }))
    .sort((a, b) => a.line - b.line || a.col - b.col);
}

function runtimeMatches(reference: Reference, dir: string): boolean {
  const want = expectedOf(dir);
  const got = reference.run(read(dir, "program.ms"), read(dir, "map.txt"));
  if (got.outcome.kind !== want.outcome.kind) return false;
  if (got.outcome.kind === "runtimeError") {
    if (got.outcome.code !== want.outcome.code || got.outcome.line !== want.outcome.line) {
      return false;
    }
  }
  if (got.gold !== want.gold || got.steps !== want.steps || !same(got.console, want.console)) {
    return false;
  }
  if (want.robot) {
    const { pos, dir: facing } = got.finalRobot;
    if (pos.row !== want.robot.row || pos.col !== want.robot.col) return false;
    if (want.robot.dir && facing !== want.robot.dir) return false;
  }
  if (want.discovered && !same(got.discovered, want.discovered)) return false;
  return !want.events || same(got.events, want.events);
}

function syntaxMatches(reference: Reference, dir: string): boolean {
  const want = expectedOf(dir);
  const got = reference.check(read(dir, "program.ms"));
  return got.valid === want.valid && diagnosticsMatch(want.diagnostics ?? [], got.diagnostics);
}

function mapMatches(reference: Reference, dir: string): boolean {
  const want = expectedOf(dir);
  const got = reference.parseMapText(read(dir, "map.txt"));
  if ((got.map !== null) !== want.valid) return false;
  if (got.info && want.goldTotal !== undefined && got.info.goldTotal !== want.goldTotal) {
    return false;
  }
  return diagnosticsMatch(want.diagnostics ?? [], errorsOf(got.diagnostics));
}

function killingCases(reference: Reference): string[] {
  const checks: [string, (reference: Reference, dir: string) => boolean][] = [
    ["runtime", runtimeMatches],
    ["syntax", syntaxMatches],
    ["maps", mapMatches],
  ];
  return checks.flatMap(([kind, matches]) =>
    caseDirs(kind).flatMap((dir) => {
      const name = `${kind}/${dir.split(/[\\/]/).at(-1)}`;
      try {
        return matches(reference, dir) ? [] : [name];
      } catch {
        return [name];
      }
    }),
  );
}

function applyPatch(text: string, patch: Patch): string {
  const first = text.indexOf(patch.from);
  if (first === -1 || text.indexOf(patch.from, first + 1) !== -1) {
    throw new Error(`A minta nem pontosan egyszer szerepel: ${patch.file}: ${patch.from}`);
  }
  return text.replace(patch.from, patch.to);
}

async function loadVariant(patches: readonly Patch[]): Promise<Reference> {
  const dir = mkdtempSync(join(tmpdir(), "minescript-mutant-"));
  workDirs.push(dir);
  for (const file of readdirSync(srcDir)) copyFileSync(join(srcDir, file), join(dir, file));
  for (const patch of patches) {
    const target = join(dir, patch.file);
    writeFileSync(target, applyPatch(readFileSync(target, "utf8"), patch));
  }
  return (await import(pathToFileURL(join(dir, "index.ts")).href)) as Reference;
}

afterAll(() => {
  for (const dir of workDirs) rmSync(dir, { recursive: true, force: true });
});

describe("mutációs ellenőrzés: a conformance-csomag minden elrontott referencián elbukik", () => {
  test("a változatlan másolat minden conformance-esetet teljesít", async () => {
    expect(killingCases(await loadVariant([]))).toEqual([]);
  });

  for (const mutant of MUTANTS) {
    test(`elbukik, ha ${mutant.name}`, async () => {
      expect(killingCases(await loadVariant(mutant.patches)).length).toBeGreaterThan(0);
    });
  }
});
