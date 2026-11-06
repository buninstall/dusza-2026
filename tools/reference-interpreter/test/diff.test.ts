import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createEngine, type Engine } from "@minescript/engine";
import { generateProgram } from "../src/generate.ts";
import { run as referenceRun } from "../src/index.ts";

const root = join(import.meta.dir, "..", "..", "..");
const runtimeCases = join(root, "conformance", "runtime");
const GENERATED_CASES = 200;

let engine: Engine;

beforeAll(async () => {
  const wasm = await Bun.file(
    join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"),
  ).arrayBuffer();
  engine = createEngine(wasm);
});

function comparable(src: string, mapText: string) {
  const wasm = engine.run(src, mapText);
  const reference = referenceRun(src, mapText);
  return { wasm, reference };
}

describe.skipIf(!process.env.REFERENCE)("referencia ↔ WASM", () => {
  for (const name of readdirSync(runtimeCases).sort()) {
    test(`conformance/${name}`, () => {
      const dir = join(runtimeCases, name);
      const { wasm, reference } = comparable(
        readFileSync(join(dir, "program.ms"), "utf8"),
        readFileSync(join(dir, "map.txt"), "utf8"),
      );
      expect(reference).toEqual(wasm);
    });
  }

  test(`${GENERATED_CASES} generált program`, () => {
    for (let seed = 1; seed <= GENERATED_CASES; seed += 1) {
      const generated = generateProgram(seed);
      const { wasm, reference } = comparable(generated.program, generated.map);
      expect({ seed, result: reference }).toEqual({ seed, result: wasm });
    }
  });
});
