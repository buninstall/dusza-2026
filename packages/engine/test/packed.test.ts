import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as bindings from "../pkg/minescript_wasm.js";
import type { Engine } from "../src/index.ts";
import { loadEngine } from "./load.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
const OPEN_FIELD = `15 15\n${Array.from({ length: 15 }, (_, row) =>
  Array.from({ length: 15 }, (_, col) => (row === 7 && col === 7 ? ">" : "@")).join(""),
).join("\n")}\n`;

const STRESS = [
  "set i to 0\nwhile true\n    set i to i + 1\n    set big to i * 1000000000\n    print big\n    set odd to not true\n    print odd\n",
  "set n to 0\nwhile true\n    set wall to isThere 1\n    if wall\n        turn by 1\n    else\n        step forward 3\n",
  "set count to 0\nwhile true\n    set gold to isThere 2\n    if gold\n        step forward 1\n        mine here\n        set count to count + 1\n    else\n        turn by 1\n    print count\n",
  "set a to 9007199254740991\n",
  "set x to 100\nset x to x * 100\nset x to x * 100\nset x to x * 100\nset x to x * 100\nset x to x * 100\nset x to x * 100\nset x to x * 100\nset x to x * 100\n",
  "mine here\n",
  "step  forward 1\nset árany to 1\n\tprint 1\n",
  "",
];

function files(dir: string, extension: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => join(dir, name));
}

const programs = [
  ...STRESS,
  ...files(join(ROOT, "conformance"), ".ms").map((path) => readFileSync(path, "utf8")),
  ...files(join(ROOT, "docs", "receptek"), ".ms").map((path) => readFileSync(path, "utf8")),
];
const maps = [
  OPEN_FIELD,
  ...files(join(ROOT, "docs", "receptek", "palyak"), ".txt").map((path) =>
    readFileSync(path, "utf8"),
  ),
];

function outcomeOf<T>(work: () => T): string {
  try {
    return JSON.stringify(work());
  } catch (error) {
    return `throws: ${(error as Error).message}`;
  }
}

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

describe("a tömörített átvitel ugyanazt adja, mint a közvetlen kötés", () => {
  test("run: minden program minden térképen", () => {
    expect(programs.length).toBeGreaterThan(100);
    for (const source of programs) {
      for (const map of [...maps, "0 0\n"]) {
        expect(outcomeOf(() => engine.run(source, map))).toBe(
          outcomeOf(() => bindings.run(source, map)),
        );
      }
    }
  });

  test("analyze: minden program", () => {
    for (const source of [...programs, ...programs.map((source) => source.replaceAll(" ", "  "))]) {
      expect(outcomeOf(() => engine.analyze(source))).toBe(
        outcomeOf(() => bindings.analyze(source)),
      );
    }
  });
});
