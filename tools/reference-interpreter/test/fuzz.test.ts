import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { join } from "node:path";
import { createEngine, type Diagnostic, type Engine, type RunResult } from "@minescript/engine";
import { generateProgram } from "../src/generate.ts";
import { check, parseMapText, run as referenceRun } from "../src/index.ts";
import { createRandom, type Random } from "../src/prng.ts";

setDefaultTimeout(600_000);

const FUZZ_SEEDS = Number(process.env.FUZZ_SEEDS ?? "1500");
const root = join(import.meta.dir, "..", "..", "..");
const seeds = Array.from({ length: FUZZ_SEEDS }, (_, index) => index + 1);
const PROGRAM_ALPHABET = [
  " ",
  "  ",
  "\t",
  "\n",
  "\r",
  "a",
  "Z",
  "0",
  "9",
  "1",
  "+",
  "-",
  "<",
  ">",
  "=",
  "_",
  "é",
  "@",
  ".",
  "e",
  "s",
  "T",
];
const MAP_ALPHABET = [" ", "\n", "\r", "\t", ".", "@", "#", ">", "<", "^", "v", "0", "1", "6", "x"];

let engine: Engine;

beforeAll(async () => {
  const wasm = await Bun.file(
    join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"),
  ).arrayBuffer();
  engine = createEngine(wasm);
});

function mutateOnce(random: Random, text: string, alphabet: readonly string[]): string {
  const at = random.int(0, Math.max(text.length - 1, 0));
  const operation = random.int(0, 2);
  if (operation === 0) return text.slice(0, at) + text.slice(at + 1);
  if (operation === 1) return text.slice(0, at) + random.pick(alphabet) + text.slice(at);
  return text.slice(0, at) + random.pick(alphabet) + text.slice(at + 1);
}

function errorPositions(diagnostics: readonly Diagnostic[]) {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => `${diagnostic.span.line}:${diagnostic.code}`)
    .sort();
}

function comparable(result: RunResult) {
  const outcome =
    result.outcome.kind === "runtimeError"
      ? { kind: "runtimeError", code: result.outcome.code, line: result.outcome.line }
      : { kind: result.outcome.kind };
  return JSON.parse(
    JSON.stringify({
      outcome,
      events: result.events,
      gold: result.gold,
      steps: result.steps,
      console: result.console,
      finalRobot: result.finalRobot,
      discovered: result.discovered,
    }),
  );
}

function syntaxMismatch(seed: number, program: string): string | null {
  let reference: string[];
  let other: string[];
  try {
    reference = check(program)
      .diagnostics.map(({ code, line }) => `${line}:${code}`)
      .sort();
  } catch (error) {
    return `seed ${seed}: a referencia kivételt dobott: ${String(error)}`;
  }
  try {
    other = errorPositions(engine.analyze(program).diagnostics);
  } catch (error) {
    return `seed ${seed}: a WASM analyze kivételt dobott: ${String(error)}`;
  }
  if (Bun.deepEquals(reference, other)) return null;
  return `seed ${seed}: ${JSON.stringify(program)}\n  referencia: ${reference.join(", ")}\n  WASM:       ${other.join(", ")}`;
}

function runMismatch(seed: number, program: string, map: string): string | null {
  const reference = comparable(referenceRun(program, map));
  const other = comparable(engine.run(program, map));
  if (Bun.deepEquals(reference, other)) return null;
  return `seed ${seed}: ${JSON.stringify(program)} @ ${JSON.stringify(map)}\n  referencia: ${JSON.stringify(reference.outcome)} steps ${reference.steps} gold ${reference.gold}\n  WASM:       ${JSON.stringify(other.outcome)} steps ${other.steps} gold ${other.gold}`;
}

function goldMap(random: Random): string {
  const rows = random.int(1, 15);
  const cols = random.int(1, 15);
  const robotRow = random.int(0, rows - 1);
  const robotCol = random.int(0, cols - 1);
  const lines = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      if (row === robotRow && col === robotCol) return random.pick([">", "<", "^", "v"]);
      return random.pick(["@", "@", "@", ".", ".", "#"]);
    }).join(""),
  );
  return `${rows} ${cols}\n${lines.join("\n")}\n`;
}

function minerProgram(random: Random): string {
  const lines: string[] = ["set n to 0"];
  const statements = random.int(1, 12);
  for (let index = 0; index < statements; index += 1) {
    const choice = random.int(0, 19);
    if (choice === 0) lines.push(`step forward ${random.int(0, 4)}`);
    else if (choice === 1) lines.push("mine here");
    else if (choice < 5) lines.push(`turn by ${random.int(0, 5)}`);
    else if (choice < 10) {
      lines.push("set g to isThere 2", "if g", " step forward 1", " mine here", " set n to n + 1");
    } else if (choice < 13) {
      lines.push("set w to isThere 0", "if w", " step forward 1", "else", " turn by 1");
    } else if (choice < 19) {
      lines.push(
        `set k to ${random.int(0, 8)}`,
        "set c to k > 0",
        "while c",
        "  set k to k - 1",
        "  set c to k > 0",
        "  set g to isThere 2",
        "  if g",
        "    step forward 1",
        "    mine here",
        "    set n to n + 1",
        "  else",
        "    turn by 1",
      );
    } else {
      lines.push("print n");
    }
  }
  lines.push("print n");
  return `${lines.join("\n")}\n`;
}

describe("szintaxis-fuzz: egykarakteres mutációk", () => {
  test(`${FUZZ_SEEDS} mutált program: a két motor ugyanazt a hibakódot és sort adja, egyik sem dob kivételt`, () => {
    const mismatches = seeds.flatMap((seed) => {
      const random = createRandom(seed * 7919);
      let program = generateProgram(seed).program;
      const count = random.int(1, 3);
      for (let index = 0; index < count; index += 1) {
        program = mutateOnce(random, program, PROGRAM_ALPHABET);
      }
      const found = syntaxMismatch(seed, program);
      return found ? [found] : [];
    });
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  test(`${FUZZ_SEEDS} mutált program: a futás is egyezik, a hibás program el sem indul`, () => {
    const mismatches = seeds.flatMap((seed) => {
      const random = createRandom(seed * 104_729);
      const generated = generateProgram(seed);
      const program = mutateOnce(random, generated.program, PROGRAM_ALPHABET);
      const result = engine.run(program, generated.map);
      if (result.outcome.kind === "syntaxError" && (result.steps !== 0 || result.events.length)) {
        return [`seed ${seed}: szintaktikai hibás program futott`];
      }
      const found = runMismatch(seed, program, generated.map);
      return found ? [found] : [];
    });
    expect(mismatches.slice(0, 5)).toEqual([]);
  });
});

describe("térkép-fuzz: egykarakteres mutációk", () => {
  test(`${FUZZ_SEEDS} mutált térkép: érvényesség és hibakódok soronként egyeznek`, () => {
    const mismatches = seeds.flatMap((seed) => {
      const random = createRandom(seed * 15_485_863);
      let text = generateProgram(seed).map;
      const count = random.int(1, 3);
      for (let index = 0; index < count; index += 1) {
        text = mutateOnce(random, text, MAP_ALPHABET);
      }
      const reference = parseMapText(text);
      const other = engine.parseMap(text);
      const left = { valid: reference.map !== null, errors: errorPositions(reference.diagnostics) };
      const right = { valid: other.map !== null, errors: errorPositions(other.diagnostics) };
      if (left.valid && !Bun.deepEquals(reference.map, other.map)) {
        return [`seed ${seed}: ${JSON.stringify(text)} eltérő térképet olvas be`];
      }
      if (left.valid !== (left.errors.length === 0)) {
        return [`seed ${seed}: ${JSON.stringify(text)} érvényes, mégis hibát jelez`];
      }
      return Bun.deepEquals(left, right)
        ? []
        : [
            `seed ${seed}: ${JSON.stringify(text)}\n  ref ${JSON.stringify(left)}\n  WASM ${JSON.stringify(right)}`,
          ];
    });
    expect(mismatches.slice(0, 5)).toEqual([]);
  });
});

describe("robot-API fuzz aranyban gazdag térképeken", () => {
  test(`${FUZZ_SEEDS} bányászó program: a teljes futás eseményről eseményre egyezik`, () => {
    let mining = 0;
    const mismatches = seeds.flatMap((seed) => {
      const random = createRandom(seed * 2_654_435_761);
      const map = goldMap(random);
      const program = minerProgram(random);
      const outcome = referenceRun(program, map);
      if (outcome.outcome.kind === "syntaxError") return [`seed ${seed}: a generált program hibás`];
      if (outcome.gold > 0) mining += 1;
      const found = runMismatch(seed, program, map);
      return found ? [found] : [];
    });
    expect(mismatches.slice(0, 5)).toEqual([]);
    expect(mining).toBeGreaterThan(FUZZ_SEEDS / 4);
  });
});
