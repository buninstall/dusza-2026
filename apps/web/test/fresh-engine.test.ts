import { describe, expect, test } from "vitest";
import * as glue from "../../../packages/engine/pkg/minescript_wasm.js";
import { bindingsEngine, freshEngine } from "../src/engine/fresh-engine.ts";
import { wasmBytes } from "./support/engine.ts";

const MAP = "1 3\n>.@\n";
const module = new WebAssembly.Module(wasmBytes);

describe("friss motorpéldány", () => {
  test("a kötések minden motorfüggvényt elérnek", () => {
    glue.initSync({ module });
    const engine = bindingsEngine(glue);
    expect(engine.version()).toMatch(/\d/);
    expect(engine.keywords()).toContain("while");
    expect(engine.analyze("print 1\n").diagnostics).toEqual([]);
    expect(engine.format("step  forward 1\n", undefined).text).toBe("step forward 1\n");
    expect(engine.complete("st", 2).length).toBeGreaterThan(0);
    expect(engine.hover("print 1\n", 1)).toBeDefined();
    const parsed = engine.parseMap(MAP);
    expect(parsed.map).not.toBeNull();
    if (parsed.map) {
      expect(engine.serializeMap(parsed.map)).toBe(MAP);
      expect(engine.mapInfo(parsed.map).goldTotal).toBe(1);
    }
    expect(engine.run("step forward 1\nmine here\n", MAP).gold).toBe(0);
    expect(engine.astDump("print 1\n")).toContain("print");
  });

  test("új példányt tölt be ugyanabból a modulból", async () => {
    const engine = await freshEngine(module);
    expect(engine.run("step forward 2\nmine here\n", MAP).gold).toBe(1);
  });
});
