import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEngine, type Engine } from "@minescript/engine";

export const WASM_PATH = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "engine",
  "pkg",
  "minescript_wasm_bg.wasm",
);

export const wasmBytes = readFileSync(WASM_PATH);

export const realEngine: Engine = createEngine(wasmBytes);

export function engineWith(overrides: Partial<Engine>): Engine {
  return { ...realEngine, ...overrides };
}
