import * as bindings from "../pkg/minescript_wasm.js";
import type {
  Analysis,
  CompletionItem,
  FormatOptions,
  FormatResult,
  Hover,
  MapInfo,
  MapParseResult,
  MineMap,
  Outcome,
  Pos,
  RunResult,
} from "./generated/index.ts";

export type * from "./generated/index.ts";

export type Engine = {
  version(): string;
  keywords(): string[];
  analyze(src: string): Analysis;
  format(src: string, options?: FormatOptions): FormatResult;
  complete(src: string, offset: number): CompletionItem[];
  hover(src: string, offset: number): Hover | undefined;
  parseMap(text: string): MapParseResult;
  serializeMap(map: MineMap): string;
  mapInfo(map: MineMap): MapInfo;
  run(src: string, mapText: string): RunResult;
  astDump(src: string): string;
};

export type RuntimeErrorOutcome = Extract<Outcome, { kind: "runtimeError" }>;
export type SyntaxErrorOutcome = Extract<Outcome, { kind: "syntaxError" }>;

const engine: Engine = {
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

export function createEngine(wasm: BufferSource | WebAssembly.Module): Engine {
  bindings.initSync({ module: wasm });
  return engine;
}

export function isRuntimeError(outcome: Outcome): outcome is RuntimeErrorOutcome {
  return outcome.kind === "runtimeError";
}

export function isSyntaxError(outcome: Outcome): outcome is SyntaxErrorOutcome {
  return outcome.kind === "syntaxError";
}

export function formatPos(pos: Pos): string {
  return `${pos.row + 1}. sor, ${pos.col + 1}. oszlop`;
}
