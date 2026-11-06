import type {
  Analysis,
  CompletionItem,
  Engine,
  FormatResult,
  Hover,
  MapInfo,
  MapParseResult,
  RunResult,
} from "@minescript/engine";
import glueUrl from "../../../../packages/engine/pkg/minescript_wasm.js?url";

type Bindings = typeof import("../../../../packages/engine/pkg/minescript_wasm.js");

export function bindingsEngine(bindings: Bindings): Engine {
  return {
    version: () => bindings.version(),
    keywords: () => bindings.keywords(),
    analyze: (src) => bindings.analyze(src) as Analysis,
    format: (src, options) => bindings.format(src, options) as FormatResult,
    complete: (src, offset) => bindings.complete(src, offset) as CompletionItem[],
    hover: (src, offset) => bindings.hover(src, offset) as Hover | undefined,
    parseMap: (text) => bindings.parseMap(text) as MapParseResult,
    serializeMap: (map) => bindings.serializeMap(map),
    mapInfo: (map) => bindings.mapInfo(map) as MapInfo,
    run: (src, mapText) => bindings.run(src, mapText) as RunResult,
    astDump: (src) => bindings.astDump(src),
  };
}

let generation = 0;

export async function freshEngine(module: WebAssembly.Module): Promise<Engine> {
  generation += 1;
  const url = `${glueUrl}?instance=${generation}`;
  const bindings = (await import(url)) as Bindings;
  bindings.initSync({ module });
  return bindingsEngine(bindings);
}
