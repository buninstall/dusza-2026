import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { diagnosticTitles, runtimeErrors } from "../src/i18n/hu.ts";

const generated = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "engine",
  "src",
  "generated",
);

function literals(file: string): string[] {
  const source = readFileSync(join(generated, file), "utf8");
  return [...source.matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1] ?? "").sort();
}

describe("i18n teljesség", () => {
  test("minden RuntimeErrorCode-hoz van magyar szöveg", () => {
    const codes = literals("RuntimeErrorCode.ts");
    expect(codes.length).toBeGreaterThan(0);
    expect(Object.keys(runtimeErrors).sort()).toEqual(codes);
    for (const text of Object.values(runtimeErrors)) {
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.hint.length).toBeGreaterThan(0);
    }
  });

  test("minden DiagCode-hoz van magyar cím", () => {
    const codes = literals("DiagCode.ts");
    expect(codes.length).toBeGreaterThan(0);
    expect(Object.keys(diagnosticTitles).sort()).toEqual(codes);
  });
});
