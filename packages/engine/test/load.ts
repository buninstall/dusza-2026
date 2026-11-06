import { createEngine, type Engine } from "../src/index.ts";

export async function loadEngine(): Promise<Engine> {
  const wasm = await Bun.file(
    new URL("../pkg/minescript_wasm_bg.wasm", import.meta.url),
  ).arrayBuffer();
  return createEngine(wasm);
}
