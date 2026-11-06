import { describe, expect, test } from "bun:test";
import {
  DEFAULT_GENERATOR_OPTIONS,
  generateInvalidProgram,
  generateMap,
  generateProgram,
  MUTATIONS,
} from "../src/generate.ts";
import { check, parseMapText, run } from "../src/index.ts";
import { createRandom } from "../src/prng.ts";

const SEEDS = 2000;
const seeds = Array.from({ length: SEEDS }, (_, index) => index + 1);

describe("generateProgram", () => {
  test("azonos seed azonos programot és térképet ad", () => {
    expect(generateProgram(42)).toEqual(generateProgram(42));
    expect(generateProgram(42)).not.toEqual(generateProgram(43));
    expect(generateInvalidProgram(7)).toEqual(generateInvalidProgram(7));
  });

  test(`${SEEDS} seed: minden program szintaktikailag helyes, minden térkép érvényes`, () => {
    for (const seed of seeds) {
      const generated = generateProgram(seed);
      expect({ seed, diagnostics: check(generated.program).diagnostics }).toEqual({
        seed,
        diagnostics: [],
      });
      expect({ seed, map: parseMapText(generated.map).map !== null }).toEqual({ seed, map: true });
    }
  });

  test("minden utasításfajta, operátor és kimenetel előfordul", () => {
    const words = new Set<string>();
    const outcomes = new Set<string>();
    const indents = new Set<number>();
    for (const seed of seeds) {
      const generated = generateProgram(seed);
      for (const line of generated.program.split(/\r?\n/)) {
        indents.add(line.length - line.trimStart().length);
        for (const word of line.trim().split(" ")) words.add(word);
      }
      const result = run(generated.program, generated.map);
      outcomes.add(
        result.outcome.kind === "runtimeError" ? result.outcome.code : result.outcome.kind,
      );
    }
    for (const word of ["step", "turn", "mine", "print", "set", "if", "else", "while", "isThere"]) {
      expect(words).toContain(word);
    }
    for (const word of ["+", "-", "*", "=", "<>", "<", "<=", ">", ">=", "and", "or", "not"]) {
      expect(words).toContain(word);
    }
    expect([...indents].filter((indent) => indent > 0).length).toBeGreaterThan(5);
    expect([...outcomes].sort()).toEqual(
      [
        "E_BAD_ARG",
        "E_BAD_OPERAND",
        "E_BEDROCK_HIT",
        "E_INT_OVERFLOW",
        "E_NON_BOOL_CONDITION",
        "E_NO_GOLD",
        "E_TYPE_MISMATCH",
        "E_UNINITIALIZED",
        "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
        "ok",
      ].sort(),
    );
  });

  test("a beállítások korlátozzák a program hosszát", () => {
    const options = { ...DEFAULT_GENERATOR_OPTIONS, maxLines: 3, maxDepth: 0 };
    for (const seed of seeds.slice(0, 200)) {
      const lines = generateProgram(seed, options).program.split(/\r?\n/).filter(Boolean);
      expect(lines.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("generateMap", () => {
  test("1..15 közötti méretek, pontosan egy robot", () => {
    const random = createRandom(5);
    const sizes = new Set<number>();
    for (let index = 0; index < 500; index += 1) {
      const result = parseMapText(generateMap(random));
      expect(result.map).not.toBeNull();
      if (result.map) sizes.add(result.map.rows).add(result.map.cols);
    }
    expect(Math.min(...sizes)).toBe(1);
    expect(Math.max(...sizes)).toBe(15);
  });
});

describe("generateInvalidProgram", () => {
  test(`${SEEDS} seed: minden mutált program szintaktikailag hibás`, () => {
    const mutations = new Set<string>();
    for (const seed of seeds) {
      const generated = generateInvalidProgram(seed);
      mutations.add(generated.mutation);
      expect({ seed, mutation: generated.mutation, valid: check(generated.program).valid }).toEqual(
        {
          seed,
          mutation: generated.mutation,
          valid: false,
        },
      );
    }
    expect([...mutations].sort()).toEqual([...MUTATIONS].sort());
  });

  test("üres programból is hibás program lesz", () => {
    const options = { ...DEFAULT_GENERATOR_OPTIONS, maxLines: 1 };
    for (const seed of seeds.slice(0, 300)) {
      expect(check(generateInvalidProgram(seed, options).program).valid).toBe(false);
    }
  });
});
