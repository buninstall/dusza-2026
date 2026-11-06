import type { Diagnostic, Engine, MineMap } from "@minescript/engine";
import { hu } from "../i18n/hu.ts";
import { decodeUtf8 } from "../lib/files.ts";

export const MAP_FILE_MAX_CHARS = 1000;

export type MapFileResult =
  | { ok: true; map: MineMap }
  | { ok: false; message: string; diagnostics: readonly Diagnostic[] };

export function parseMapFile(engine: Engine, bytes: ArrayBuffer): MapFileResult {
  const decoded = decodeUtf8(bytes);
  if (!decoded.ok) {
    return { ok: false, message: hu.mapEditor.importEncoding, diagnostics: [] };
  }
  if (decoded.text.length > MAP_FILE_MAX_CHARS) {
    return { ok: false, message: hu.mapEditor.importTooLarge, diagnostics: [] };
  }
  const parsed = engine.parseMap(decoded.text);
  if (!parsed.map) {
    return {
      ok: false,
      message: hu.mapEditor.importFailed,
      diagnostics: parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    };
  }
  return { ok: true, map: parsed.map };
}
