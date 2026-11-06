import type { Engine } from "@minescript/engine";
import { describe, expect, test, vi } from "vitest";
import { EngineCrashError, isTrap, resilientEngine } from "../src/engine/resilient.ts";
import { engineWith, realEngine } from "./support/engine.ts";

function trapped(): Engine {
  return engineWith({
    analyze: () => {
      throw new WebAssembly.RuntimeError("unreachable");
    },
  });
}

describe("újrainduló motor", () => {
  test("a hibátlan hívás átmegy, a nem WASM-hiba változatlanul továbbmegy", () => {
    const failing = engineWith({
      format: () => {
        throw new TypeError("rossz bemenet");
      },
    });
    const { engine } = resilientEngine(failing, async () => realEngine);
    expect(engine.version()).toBe(realEngine.version());
    expect(engine.keywords()).toEqual(realEngine.keywords());
    expect(() => engine.format("x")).toThrow(TypeError);
    expect(isTrap(new TypeError("x"))).toBe(false);
  });

  test("csapda után értesít, egyszer újraépít, és a friss motorral folytatja", async () => {
    const rebuild = vi.fn(async () => realEngine);
    const { engine, onCrash } = resilientEngine(trapped(), rebuild);
    const listener = vi.fn();
    const unsubscribe = onCrash(listener);
    expect(() => engine.analyze("print 1\n")).toThrow(EngineCrashError);
    expect(() => engine.analyze("print 1\n")).toThrow(EngineCrashError);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(rebuild).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(engine.analyze("print 1\n").diagnostics).toEqual([]));
    unsubscribe();
    expect(engine.parseMap("1 2\n>@\n").map).not.toBeNull();
    expect(engine.run("mine here\n", "1 2\n>@\n").outcome.kind).toBe("runtimeError");
  });

  test("sikertelen újraépítés után a régi motor marad, és újra próbálkozhat", async () => {
    const rebuild = vi.fn(async (): Promise<Engine> => {
      throw new Error("nincs WASM");
    });
    const { engine } = resilientEngine(trapped(), rebuild);
    expect(() => engine.analyze("x")).toThrow(EngineCrashError);
    await vi.waitFor(() => expect(rebuild).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(() => engine.analyze("x")).toThrow(EngineCrashError);
    await vi.waitFor(() => expect(rebuild).toHaveBeenCalledTimes(2));
  });
});
