import { createEngine, type Engine } from "@minescript/engine";
import wasmPath from "@minescript/engine/wasm" with { type: "file" };

export async function loadEngine(): Promise<Engine> {
  return createEngine(await Bun.file(wasmPath).arrayBuffer());
}
