import type { Context } from "hono";
import type { AppEnv } from "../env.ts";

export function clientAddress(c: Context<AppEnv>): string {
  try {
    return c.env?.requestIP?.(c.req.raw)?.address ?? "local";
  } catch {
    return "local";
  }
}

export function attachmentDisposition(title: string, extension: string): string {
  const ascii = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const fallback = `${ascii || "terkep"}.${extension}`;
  const encoded = encodeURIComponent(`${title}.${extension}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
