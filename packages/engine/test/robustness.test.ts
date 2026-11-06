import { beforeAll, describe, expect, test } from "bun:test";
import type { Engine } from "../src/index.ts";
import { loadEngine } from "./load.ts";

const MAP = "1 3\n>..\n";
const DEPTH = 5000;

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

function nested(header: string, depth: number): string {
  const lines = Array.from({ length: depth }, (_, level) => `${" ".repeat(level)}${header}`);
  return `${lines.join("\n")}\n${" ".repeat(depth)}print 1\n`;
}

function nestedElse(depth: number): string {
  const lines = Array.from({ length: depth }, (_, level) => {
    const indent = " ".repeat(level);
    return `${indent}if false\n${indent}else`;
  });
  return `${lines.join("\n")}\n${" ".repeat(depth)}print 1\n`;
}

function stillWorks() {
  const result = engine.run("print 1", MAP);
  expect(result.outcome).toEqual({ kind: "ok" });
  expect(result.console).toEqual(["1"]);
}

describe("a motor szélsőséges bemenetekre sem omlik össze", () => {
  test(`${DEPTH} mélyen egymásba ágyazott blokk: futás, elemzés, formázás`, () => {
    for (const source of [nested("if true", DEPTH), nested("while x", DEPTH), nestedElse(DEPTH)]) {
      const result = engine.run(source, MAP);
      expect(["ok", "runtimeError"]).toContain(result.outcome.kind);
      expect(engine.analyze(source).diagnostics.some((d) => d.severity === "error")).toBe(false);
      expect(engine.format(source, { indentWidth: 1 }).text).toBe(source);
      expect(engine.complete(source, source.length).length).toBeGreaterThan(0);
      expect(engine.hover(source, 1)).toBeDefined();
      stillWorks();
    }
  });

  test("100 000 soros program és 1 MB-os sor", () => {
    const lines = Array.from({ length: 100_000 }, () => "turn by 1").join("\n");
    const limited = engine.run(lines, MAP);
    expect(limited.outcome).toMatchObject({
      kind: "runtimeError",
      code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
      line: 1001,
    });
    expect(limited.steps).toBe(1000);
    const longLine = `print ${"a".repeat(1_000_000)}`;
    expect(engine.run(longLine, MAP).outcome).toMatchObject({ code: "E_UNINITIALIZED", line: 1 });
    stillWorks();
  });

  test("tartományon kívüli kurzorpozíció és hibás formázási beállítás", () => {
    for (const offset of [-1, 1e12, Number.NaN, 0.5]) {
      expect(Array.isArray(engine.complete("print 1", offset))).toBe(true);
      expect(() => engine.hover("print 1", offset)).not.toThrow();
    }
    expect(engine.hover("set x to 1\nprint 😀x", 18)).toBeUndefined();
    expect(engine.format("if true\n print 1", { indentWidth: 0 }).text).toBe("if true\n print 1\n");
    expect(engine.format("if true\n print 1", { indentWidth: 1e9 }).text).toBe(
      `if true\n${" ".repeat(16)}print 1\n`,
    );
    expect(() => engine.format("print 1", { indentWidth: -1 })).toThrow("formázási beállítások");
    stillWorks();
  });

  test("10 MB-os és 1000 soros térkép érthető hibával", () => {
    const wide = engine.parseMap(`3 15\n${".".repeat(10_000_000)}`);
    expect(wide.map).toBeNull();
    expect(wide.diagnostics.map((d) => d.code)).toEqual([
      "MAP_ROW_COUNT",
      "MAP_NO_ROBOT",
      "MAP_ROW_LENGTH",
    ]);
    const tall = engine.parseMap(`1000 2\n${Array.from({ length: 1000 }, () => ">.").join("\n")}`);
    expect(tall.diagnostics.map((d) => d.code)).toEqual(["MAP_DIM_RANGE"]);
    expect(() => engine.run("print 1", `3 3\n${"...\n".repeat(2_500_000)}`)).toThrow(
      "A térkép hibás",
    );
    stillWorks();
  });
});
