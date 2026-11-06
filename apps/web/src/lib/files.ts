export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function firstFile(files: FileList | null): File | null {
  return files?.item(0) ?? null;
}

export type DecodeResult = { ok: true; text: string } | { ok: false; reason: "encoding" };

const BYTE_ORDER_MARK = "﻿";

export function decodeUtf8(bytes: ArrayBuffer): DecodeResult {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, text: text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text };
  } catch {
    return { ok: false, reason: "encoding" };
  }
}

export function normalizeNewlines(text: string): string {
  return text.replaceAll("\r\n", "\n");
}

export function safeFilename(title: string): string {
  const ascii = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "minescript";
}
