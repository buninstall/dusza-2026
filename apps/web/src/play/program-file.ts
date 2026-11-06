import { formatCount, hu } from "../i18n/hu.ts";
import { decodeUtf8, normalizeNewlines } from "../lib/files.ts";

export const PROGRAM_MAX_CHARS = 100_000;

const NUL = "\u0000";

export type ProgramFileResult = { ok: true; text: string } | { ok: false; message: string };

export function decodeProgramFile(bytes: ArrayBuffer): ProgramFileResult {
  const decoded = decodeUtf8(bytes);
  if (!decoded.ok) {
    return { ok: false, message: hu.play.importEncoding };
  }
  if (decoded.text.includes(NUL)) {
    return { ok: false, message: hu.play.importNul };
  }
  if (decoded.text.length > PROGRAM_MAX_CHARS) {
    return { ok: false, message: hu.play.importTooLong(formatCount(PROGRAM_MAX_CHARS)) };
  }
  return { ok: true, text: normalizeNewlines(decoded.text) };
}
