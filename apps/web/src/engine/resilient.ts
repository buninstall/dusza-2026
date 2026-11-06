import type { Engine } from "@minescript/engine";

export type EngineFactory = () => Promise<Engine>;

type Listener = () => void;

export class EngineCrashError extends Error {
  constructor(cause: unknown) {
    super("A MineScript-motor futás közben leállt.", { cause });
    this.name = "EngineCrashError";
  }
}

export function isTrap(error: unknown): boolean {
  return typeof WebAssembly !== "undefined" && error instanceof WebAssembly.RuntimeError;
}

type ResilientEngine = { engine: Engine; onCrash: (listener: Listener) => () => void };

export function resilientEngine(initial: Engine, rebuild: EngineFactory): ResilientEngine {
  let current = initial;
  let isRebuilding = false;
  const listeners = new Set<Listener>();

  const recover = () => {
    for (const listener of listeners) {
      listener();
    }
    if (isRebuilding) {
      return;
    }
    isRebuilding = true;
    void rebuild()
      .then((fresh) => {
        current = fresh;
      })
      .catch(() => undefined)
      .finally(() => {
        isRebuilding = false;
      });
  };

  const guard =
    <K extends keyof Engine>(key: K) =>
    (...args: Parameters<Engine[K]>): ReturnType<Engine[K]> => {
      try {
        const method = current[key] as (...input: Parameters<Engine[K]>) => ReturnType<Engine[K]>;
        return method(...args);
      } catch (error) {
        if (isTrap(error)) {
          recover();
          throw new EngineCrashError(error);
        }
        throw error;
      }
    };

  const engine: Engine = {
    version: guard("version"),
    keywords: guard("keywords"),
    analyze: guard("analyze"),
    format: guard("format"),
    complete: guard("complete"),
    hover: guard("hover"),
    parseMap: guard("parseMap"),
    serializeMap: guard("serializeMap"),
    mapInfo: guard("mapInfo"),
    run: guard("run"),
    astDump: guard("astDump"),
  };

  return {
    engine,
    onCrash: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
